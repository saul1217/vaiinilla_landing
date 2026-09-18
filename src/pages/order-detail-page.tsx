import { useEffect, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { PedidoChargeOverlay } from '../components/pedido-charge-overlay';
import { StripePaymentPanel } from '../components/stripe-payment-panel';
import { OrderPickupPanel } from '../components/order-pickup-panel';
import { OrderTrackCard } from '../components/order-track-card';
import { useAuth } from '../context/auth-context';
import { useBuyerSession } from '../context/buyer-session';
import { useCart } from '../context/cart-context';
import { api } from '../lib/api';
import { lastPlaceSlug } from '../lib/last-place';
import { errorMessage } from '../lib/api-error';
import { forgetIdempotencyKey, idempotencyKeyFor } from '../lib/idempotency';
import { formatAmount } from '../lib/money';
import { catalogImageMap, orderThumbUrl } from '../lib/catalog-images';
import { usePickupQrToken } from '../lib/use-pickup-qr';
import {
  isTerminalOrderStatus,
  orderDestinationLabel,
  orderPayLabel,
} from '../lib/order-labels';
import { clearPendingStripeOrderId, stripeRetryFingerprint, markStripeConfirming, isStripeConfirming, clearStripeConfirming } from '../lib/stripe-pending';
import {
  clearStripeCheckoutSession,
  rememberStripeCheckoutSession,
  takeStripeCheckoutSession,
} from '../lib/stripe-session';
import {
  canRetryStripePayment,
  isStripePaymentConfirmedByBackend,
  pollStripePaymentConfirmation,
  STRIPE_COPY,
  STRIPE_POLL_INTERVAL_MS,
  stripePaymentCopy,
} from '../lib/stripe-status';
import type { CatalogProduct, OrderDetail, StripePaymentSession } from '../types/api';

const POLL_MS = 5000;

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const { user, ready } = useAuth();
  const { cart } = useCart();
  const { context, openClientSession } = useBuyerSession();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stripeSession, setStripeSession] = useState<StripePaymentSession | null>(() =>
    takeStripeCheckoutSession(id),
  );
  const [stripePolling, setStripePolling] = useState(
    () => hasStripeRedirectParams() || isStripeConfirming(id),
  );
  const [localCanceled, setLocalCanceled] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retrySessionReady, setRetrySessionReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [panelProcessing, setPanelProcessing] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const awaitingChargeRef = useRef(false);
  const orderRef = useRef<OrderDetail | null>(null);
  orderRef.current = order;
  const pickupQrToken = usePickupQrToken(order, accessToken);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const run = async (silent = false) => {
      try {
        let session = context;
        const slug = cart?.slug ?? lastPlaceSlug();
        if (!session && slug) {
          const place = await api.getEstablishment(slug);
          session = await openClientSession(user, place);
        }
        if (!session) {
          setError('Abre una sesión de cafetería para consultar este pedido.');
          return;
        }
        setAccessToken(session.access_token);
        const next = await api.getOrder(session.access_token, id);
        if (!active) return;
        setOrder(next);
        setError(null);
        if (isStripePaymentConfirmedByBackend(next)) {
          clearPendingStripeOrderId(next.id);
          clearStripeCheckoutSession(next.id);
          clearStripeConfirming(next.id);
          setStripeSession(null);
        } else if (
          next.metodo_pago === 'stripe' &&
          (next.pago?.payment_status === 'fallido' || next.pago?.payment_status === 'cancelado')
        ) {
          // Un intento terminado no debe bloquear la creación de un pedido nuevo.
          clearPendingStripeOrderId(next.id);
          clearStripeCheckoutSession(next.id);
          clearStripeConfirming(next.id);
        }
      } catch (cause) {
        if (active && !silent) setError(errorMessage(cause));
      }
    };
    void run();
    const timer = window.setInterval(() => {
      const current = orderRef.current;
      if (current && isTerminalOrderStatus(current.estado)) return;
      void run(true);
    }, currentPollMs(orderRef.current));
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [cart?.slug, context, id, openClientSession, user]);

  useEffect(() => {
    const slug = cart?.slug ?? lastPlaceSlug();
    if (!slug) return;
    let active = true;
    void api
      .getGuestCatalog(slug)
      .then((catalog) => {
        if (active) setCatalogProducts(catalog.productos);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [cart?.slug]);

  useEffect(() => {
    if (!stripePolling || !id) return;
    if (!accessToken) return;
    let cancelled = false;
    const abort = new AbortController();
    void pollStripePaymentConfirmation({
      orderId: id,
      fetchOrder: (orderId) => api.getOrder(accessToken, orderId),
      signal: abort.signal,
    }).then((result) => {
      if (cancelled) return;
      if (result.order) setOrder(result.order);
      setTimedOut(result.timedOut);
      setStripePolling(false);
      if (result.order && isStripePaymentConfirmedByBackend(result.order)) {
        clearPendingStripeOrderId(result.order.id);
        clearStripeCheckoutSession(result.order.id);
        clearStripeConfirming(result.order.id);
        setStripeSession(null);
      }
    });
    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [accessToken, id, stripePolling]);

  const stripeOrder = order?.metodo_pago === 'stripe';
  const confirmed = order ? isStripePaymentConfirmedByBackend(order) : false;
  const paymentStatus = order?.pago?.payment_status;
  const awaitingCharge =
    Boolean(stripeOrder) &&
    !confirmed &&
    (stripePolling ||
      panelProcessing ||
      timedOut ||
      paymentStatus === 'processing' ||
      paymentStatus === 'requires_action');
  if (awaitingCharge) awaitingChargeRef.current = true;

  useEffect(() => {
    if (!confirmed || !awaitingChargeRef.current) return;
    awaitingChargeRef.current = false;
    setPanelProcessing(false);
    setCelebrate(true);
  }, [confirmed]);

  if (ready && !user) return <Navigate to={`/cuenta?next=/cuenta/pedidos/${id}`} replace />;

  const chargePhase = celebrate ? 'success' : awaitingCharge ? 'processing' : null;
  const staleTerminalStripeSession = Boolean(
    stripeSession &&
      order &&
      canRetryStripePayment(order) &&
      stripeSession.payment_attempt_id === order.pago?.payment_attempt_id &&
      !retrySessionReady,
  );
  const showPaymentForm =
    Boolean(stripeSession) &&
    Boolean(stripeOrder) &&
    !confirmed &&
    !stripePolling &&
    !timedOut &&
    !celebrate &&
    !staleTerminalStripeSession &&
    paymentStatus !== 'processing' &&
    paymentStatus !== 'requires_action';
  const showRetry =
    Boolean(order && (canRetryStripePayment(order) || localCanceled)) &&
    !showPaymentForm &&
    !stripePolling &&
    !panelProcessing &&
    !timedOut &&
    !celebrate &&
    !confirmed;
  const stripeMessage = timedOut
    ? STRIPE_COPY.timedOut
    : stripePolling
      ? STRIPE_COPY.processing
      : order && stripeOrder
        ? stripePaymentCopy(order)
        : null;

  async function retryStripe() {
    if (!order || !accessToken) return;
    setRetrying(true);
    setError(null);
    try {
      const fingerprint = stripeRetryFingerprint(order.id);
      const key = idempotencyKeyFor(fingerprint);
      const session = await api.retryStripePayment(accessToken, order.id, key);
      forgetIdempotencyKey(fingerprint);
      rememberStripeCheckoutSession(order.id, session);
      setStripeSession(session);
      setRetrySessionReady(true);
      setLocalCanceled(false);
      setTimedOut(false);
      clearStripeConfirming(order.id);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setRetrying(false);
    }
  }

  return (
    <AppShell tab="orders">
      <main id="main-content" className="alumno-main">
        <AlumnoPageHeader
          kicker="Pedido"
          title={order ? `#${order.folio}` : 'Seguimiento'}
          back={{ to: '/cuenta/pedidos', label: 'Volver' }}
        />
        {error ? <p className="alumno-error">{error}</p> : null}
        {chargePhase ? (
          <PedidoChargeOverlay
            phase={chargePhase}
            onDismiss={chargePhase === 'success' ? () => setCelebrate(false) : undefined}
          />
        ) : null}
        {order && stripeOrder ? (
          <section className="alumno-card alumno-stripe-status">
            {chargePhase ? null : <p role="status">{stripeMessage}</p>}
            {showPaymentForm && stripeSession ? (
              <StripePaymentPanel
                order={order}
                session={stripeSession}
                onProcessing={() => setPanelProcessing(true)}
                onProcessingFailed={() => setPanelProcessing(false)}
                onConfirmed={() => {
                  markStripeConfirming(order.id);
                  setPanelProcessing(false);
                  setStripePolling(true);
                  setTimedOut(false);
                  setLocalCanceled(false);
                }}
                onCanceled={() => {
                  setPanelProcessing(false);
                  clearStripeConfirming(order.id);
                  setLocalCanceled(true);
                  setRetrySessionReady(false);
                  setStripeSession(null);
                }}
              />
            ) : null}
            {showRetry ? (
              <button
                className="alumno-btn alumno-btn--lime"
                type="button"
                disabled={retrying}
                onClick={() => void retryStripe()}
              >
                {retrying ? 'Preparando pago…' : 'Reintentar pago'}
              </button>
            ) : null}
          </section>
        ) : null}
        {order ? (
          <div className="alumno-detail-split">
            <OrderTrackCard
              order={order}
              expanded
              completeLink={false}
              toggle={false}
              onToggle={() => undefined}
              imageUrl={orderThumbUrl(order, catalogImageMap(catalogProducts), catalogProducts)}
              pickupToken={pickupQrToken}
            />
            <OrderTicketView
              order={order}
              pickupToken={pickupQrToken}
              stripeOrder={Boolean(stripeOrder)}
            />
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}

export function OrderTicketView({
  order,
  pickupToken = null,
  stripeOrder = false,
}: {
  order: OrderDetail;
  pickupToken?: string | null;
  stripeOrder?: boolean;
}) {
  return (
    <section className="alumno-card alumno-card--ticket">
      <p className="alumno-muted">
        {orderPayLabel(order)} · {orderDestinationLabel(order)}
      </p>
      <p className="alumno-wallet-balance">{formatAmount(order.total)}</p>
      <OrderPickupPanel order={order} token={pickupToken} stripeOrder={stripeOrder} />
      <ul className="alumno-ticket-items">
        {order.items.map((item) => (
          <li key={item.id}>
            <span>
              {item.cantidad} × {item.nombre_producto}
            </span>
            <strong>{formatAmount(item.subtotal)}</strong>
          </li>
        ))}
      </ul>
      {order.notas_cocina ? <p className="alumno-muted">Nota: {order.notas_cocina}</p> : null}
    </section>
  );
}

function hasStripeRedirectParams(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return Boolean(params.get('payment_intent') || params.get('redirect_status'));
}

function currentPollMs(order: OrderDetail | null): number {
  if (order?.metodo_pago === 'stripe' && !isStripePaymentConfirmedByBackend(order)) {
    return STRIPE_POLL_INTERVAL_MS;
  }
  return POLL_MS;
}
