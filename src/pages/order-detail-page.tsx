import { useEffect, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { PedidoChargeOverlay } from '../components/pedido-charge-overlay';
import { StripePaymentPanel } from '../components/stripe-payment-panel';
import { OrderTrackCard } from '../components/order-track-card';
import { useAuth } from '../context/auth-context';
import { useBuyerSession } from '../context/buyer-session';
import { useCart } from '../context/cart-context';
import { api } from '../lib/api';
import { resolveClientSession } from '../lib/client-session';
import { lastPlaceSlug } from '../lib/last-place';
import { errorMessage } from '../lib/api-error';
import { forgetIdempotencyKey, idempotencyKeyFor } from '../lib/idempotency';
import { formatAmount } from '../lib/money';
import { catalogImageMap, orderThumbUrl } from '../lib/catalog-images';
import { usePickupQrToken } from '../lib/use-pickup-qr';
import {
  isTerminalOrderStatus,
  itemNameLabel,
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
import { orderedGroups, tableOrderState } from '../lib/shared-table';
import type { CatalogProduct, OrderDetail, SharedTable, StripePaymentSession } from '../types/api';

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
  const [tableSnapshot, setTableSnapshot] = useState<{
    orderId: string;
    table: SharedTable | null;
  } | null>(null);
  const [panelProcessing, setPanelProcessing] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const awaitingChargeRef = useRef(false);
  const orderRef = useRef<OrderDetail | null>(null);
  orderRef.current = order;
  const pickupQrToken = usePickupQrToken(order, accessToken);
  const orderId = order?.id;
  const orderSpaceId = order?.espacio?.id;

  useEffect(() => {
    if (!user) return;
    let active = true;
    const run = async (silent = false) => {
      try {
        const resolved = await resolveClientSession({
          user,
          context,
          preferredSlug: cart?.slug ?? lastPlaceSlug(),
          openClientSession,
        });
        if (!resolved) {
          setError('Abre una sesión en un establecimiento para consultar este pedido.');
          return;
        }
        setAccessToken(resolved.context.access_token);
        const next = await api.getOrder(resolved.context.access_token, id);
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
    // Cada espera se calcula con el pedido más reciente: un pago Stripe sin confirmar se
    // consulta más seguido que el resto, aunque al montar todavía no se supiera qué era.
    let timer: number | undefined;
    const schedule = () => {
      timer = window.setTimeout(() => {
        const current = orderRef.current;
        if (current && isTerminalOrderStatus(current.estado)) {
          schedule();
          return;
        }
        void run(true).finally(() => {
          if (active) schedule();
        });
      }, currentPollMs(orderRef.current));
    };
    void run().finally(() => {
      if (active) schedule();
    });
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [cart?.slug, context, id, openClientSession, user]);

  useEffect(() => {
    if (!accessToken || orderId !== id || orderSpaceId == null) return;
    let active = true;
    let loading = false;

    const refreshTable = async () => {
      if (loading) return;
      loading = true;
      try {
        const table = await api.currentTable(accessToken);
        if (active) setTableSnapshot({ orderId: id, table });
      } catch {
        // Keep the personal ticket available if the shared account is unavailable.
      } finally {
        loading = false;
      }
    };

    void refreshTable();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshTable();
    }, POLL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [accessToken, id, orderId, orderSpaceId]);

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
              table={
                order.id === id && tableSnapshot?.orderId === order.id ? tableSnapshot.table : null
              }
            />
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}

export function OrderTicketView({
  order,
  table,
}: {
  order: OrderDetail;
  table?: SharedTable | null;
}) {
  const tableIncludesOrder = Boolean(
    table?.cuenta_abierta &&
      table.grupos.some((group) => group.pedidos.some((sharedOrder) => sharedOrder.id === order.id)),
  );

  return (
    <section className="alumno-card alumno-card--ticket">
      <div className="alumno-ticket-head">
        <div className="alumno-ticket-head__copy">
          <p className="alumno-muted">
            Pedido #{order.folio} · {orderPayLabel(order)} · {orderDestinationLabel(order)}
          </p>
        </div>
        <div className="alumno-ticket-head__total">
          <p className="alumno-wallet-balance">{formatAmount(order.total)}</p>
        </div>
      </div>
      <ul className="alumno-ticket-items">
        {order.items.map((item) => (
          <li key={item.id} className={item.rechazo ? 'is-rejected' : undefined}>
            <span>
              {item.rechazo ? (
                <>
                  <del>
                    {item.cantidad} × {itemNameLabel(item.nombre_producto)}
                  </del>
                  <small className="alumno-ticket-rejection">Se quitó: {item.rechazo.motivo}</small>
                </>
              ) : (
                <>
                  {item.cantidad} × {itemNameLabel(item.nombre_producto)}
                </>
              )}
            </span>
            <strong>{item.rechazo ? <del>{formatAmount(item.subtotal)}</del> : formatAmount(item.subtotal)}</strong>
          </li>
        ))}
      </ul>
      {order.notas_cocina ? <p className="alumno-muted alumno-ticket-note">Nota: {order.notas_cocina}</p> : null}
      {tableIncludesOrder && table ? (
        <section className="alumno-ticket-table" aria-labelledby="order-table-account-title">
          <header className="alumno-ticket-table__head">
            <div>
              <h2 className="alumno-section-label" id="order-table-account-title">
                Cuenta de la mesa
              </h2>
              <p className="alumno-muted">
                {table.espacio.nombre} ·{' '}
                {table.participantes.length === 1 ? '1 persona' : `${table.participantes.length} personas`}
              </p>
            </div>
          </header>

          {orderedGroups(table)
            .filter((group) => group.pedidos.length > 0)
            .map((group) => {
              const subtotalLabel = group.soy_yo
                ? 'Subtotal de tus pedidos'
                : `Subtotal de ${group.alias ?? 'otros pedidos'}`;
              return (
                <div
                  className="alumno-ticket-table__group"
                  key={group.participante_id ?? `general-${group.pedidos.map((sharedOrder) => sharedOrder.folio).join('-')}`}
                >
                  <h3 className="alumno-section-label">
                    {group.soy_yo ? 'Tus pedidos' : (group.alias ?? 'Otros pedidos')}
                  </h3>
                  <ul className="alumno-ticket-items">
                    {group.pedidos.map((sharedOrder) => (
                      <li key={`${sharedOrder.folio}-${sharedOrder.creado_en ?? ''}`}>
                        <span className="alumno-ticket-table__order-copy">
                          <strong>Pedido #{sharedOrder.folio}</strong>
                          <span>{sharedOrder.items_resumen || 'Pedido de la mesa'}</span>
                          <small>{tableOrderState(sharedOrder)}</small>
                        </span>
                        <strong>{formatAmount(sharedOrder.total)}</strong>
                      </li>
                    ))}
                  </ul>
                  <p className="alumno-ticket-table__subtotal">
                    <span>{subtotalLabel}</span>
                    <strong>{formatAmount(group.total)}</strong>
                  </p>
                </div>
              );
            })}

          <ul className="alumno-ticket-items alumno-ticket-table__totals">
            <li>
              <span>Total de la mesa</span>
              <strong>{formatAmount(table.totales.total)}</strong>
            </li>
            <li>
              <span>Pagado</span>
              <strong>{formatAmount(table.totales.pagado)}</strong>
            </li>
            <li>
              <span>Por pagar</span>
              <strong>{formatAmount(table.totales.pendiente)}</strong>
            </li>
            <li className="alumno-ticket-table__mine">
              <strong>Tu parte por pagar</strong>
              <strong>{formatAmount(table.mi_parte.pendiente)}</strong>
            </li>
          </ul>
        </section>
      ) : null}
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
