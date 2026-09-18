import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { useAuth } from '../context/auth-context';
import { useBuyerSession } from '../context/buyer-session';
import { useCart } from '../context/cart-context';
import { api } from '../lib/api';
import { errorMessage, VaiinillaApiError } from '../lib/api-error';
import { cartTotal, isOperationallyReady, toCreateOrderInput } from '../lib/cart';
import { forgetIdempotencyKey, idempotencyKeyFor, orderFingerprint } from '../lib/idempotency';
import { formatAmount, formatMoney, moneyToCents } from '../lib/money';
import { lastPlaceSlug } from '../lib/last-place';
import { productImageUrl } from '../lib/catalog-images';
import { orderHistoryHeadline } from '../lib/order-labels';
import { rememberPickupQrToken } from '../lib/pickup-qr';
import { clearSpace, readSpace } from '../lib/space-session';
import { readPendingStripeOrderId, savePendingStripeOrderId } from '../lib/stripe-pending';
import { isStripeCheckoutEnabled, STRIPE_UNAVAILABLE_COPY } from '../lib/stripe-public';
import { rememberStripeCheckoutSession, stripeSessionFromCreatedOrder } from '../lib/stripe-session';
import { isGuestBuy } from '../lib/guest-explore';
import { GUEST_CHECKOUT_UNAVAILABLE } from '../lib/guest-checkout';
import { ESTABLISHMENT_CLOSED_MESSAGE } from '../types/api';
import type {
  CatalogProduct,
  OperationalStatus,
  OrderDetail,
  PaymentMethod,
  PublicEstablishment,
  WalletData,
} from '../types/api';

export function CartPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { cart, updateQuantity, removeLine, reset } = useCart();
  const { user, ready } = useAuth();
  const { context, openClientSession } = useBuyerSession();
  const openClientSessionRef = useRef(openClientSession);
  openClientSessionRef.current = openClientSession;
  const [place, setPlace] = useState<PublicEstablishment | null>(null);
  const [status, setStatus] = useState<OperationalStatus | null>(null);
  const [operationalError, setOperationalError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [payment, setPayment] = useState<PaymentMethod>('efectivo');
  const [notes, setNotes] = useState('');
  const [clientId, setClientId] = useState(
    () => sessionStorage.getItem(`vaiinilla.buyer.client-id.${slug}`) ?? '',
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [previousOrders, setPreviousOrders] = useState<OrderDetail[]>([]);
  const [menuPeek, setMenuPeek] = useState<CatalogProduct[]>([]);
  const space = readSpace(slug);
  const [forHere, setForHere] = useState(Boolean(space));
  const stripeEnabled = isStripeCheckoutEnabled();
  const pendingStripeOrderId = readPendingStripeOrderId();
  const guestBuy = isGuestBuy();
  const canCheckout = Boolean(user) || guestBuy;

  const lines = useMemo(() => (cart?.slug === slug ? cart.lines : []), [cart, slug]);
  const total = useMemo(() => cartTotal(lines), [lines]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      api.getEstablishment(slug),
      api.getGuestCatalog(slug).catch(() => ({ categorias: [], productos: [] })),
    ])
      .then(([next, catalog]) => {
        const products = Array.isArray(catalog?.productos) ? catalog.productos : [];
        setMenuPeek(products.filter((item) => item.disponible).slice(0, 4));
        if (!active) return;
        setPlace(next);
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!context || !place || context.contexto.establecimiento_id !== place.id) {
      setStatus(null);
      setWallet(null);
      setOperationalError(null);
      return;
    }
    let active = true;
    setStatus(null);
    setOperationalError(null);
    void Promise.all([
      api.getOperationalStatus(context.access_token),
      api.getMyWallet(context.access_token).catch(() => null),
    ])
      .then(([nextStatus, nextWallet]) => {
        if (!active) return;
        setStatus(nextStatus);
        setWallet(nextWallet);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setStatus(null);
        setOperationalError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [context, place]);

  useEffect(() => {
    if (!user) {
      setPreviousOrders([]);
      return;
    }
    let active = true;
    const run = async () => {
      try {
        let session = context;
        const placeSlug = slug || lastPlaceSlug();
        let establishment = place;
        if (!establishment && placeSlug) {
          establishment = await api.getEstablishment(placeSlug);
        }
        if (establishment && (!session || session.contexto.establecimiento_id !== establishment.id)) {
          session = await openClientSessionRef.current(user, establishment);
        }
        if (!session) return;
        const result = await api.listOrders(session.access_token);
        if (!active) return;
        const next = result.orders.filter((item) => item.estado === 'entregado').slice(0, 8);
        setPreviousOrders((current) => {
          if (
            current.length === next.length &&
            current.every((item, index) => item.id === next[index]?.id && item.estado === next[index]?.estado)
          ) {
            return current;
          }
          return next;
        });
      } catch {
        if (active) setPreviousOrders([]);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [context, place, slug, user]);

  const hasMatchingContext = Boolean(
    context && place && context.contexto.establecimiento_id === place.id,
  );
  const operationalVerificationPending = hasMatchingContext && !status && !operationalError;
  const operationalReady = isOperationallyReady(status);
  const blocker =
    lines.length === 0
      ? null
      : status
        ? operationalReady
          ? null
          : ESTABLISHMENT_CLOSED_MESSAGE
        : operationalError
          ? 'No pudimos verificar si el establecimiento está recibiendo pedidos.'
          : null;

  const insufficientBalance =
    payment === 'saldo' &&
    total &&
    wallet &&
    (moneyToCents(wallet.wallet.saldo) ?? 0n) < (moneyToCents(total) ?? 0n);

  async function confirm() {
    setError(null);
    if (!place || lines.length === 0 || !total) return;
    if (!user) {
      if (!guestBuy) {
        void navigate(`/cuenta?next=/e/${slug}/carrito`);
        return;
      }
      setSheetOpen(false);
      setError(GUEST_CHECKOUT_UNAVAILABLE);
      return;
    }
    if (payment === 'stripe' && !stripeEnabled) {
      setError(STRIPE_UNAVAILABLE_COPY);
      return;
    }
    const pendingId = readPendingStripeOrderId();
    if (pendingId) {
      setError('Tienes un pago Stripe pendiente. Resuélvelo antes de crear otro pedido.');
      return;
    }
    setSubmitting(true);
    try {
      const storedId = clientId || sessionStorage.getItem(`vaiinilla.buyer.client-id.${slug}`) || undefined;
      const session =
        context?.contexto.establecimiento_id === place.id
          ? context
          : await openClientSession(user, place, storedId);
      const operational = await api.getOperationalStatus(session.access_token);
      setStatus(operational);
      if (!isOperationallyReady(operational)) {
        throw new Error(ESTABLISHMENT_CLOSED_MESSAGE);
      }
      const destination = forHere && space ? 'en_espacio' : 'para_llevar';
      const payload = toCreateOrderInput(
        lines,
        payment,
        notes,
        destination,
        destination === 'en_espacio' && space ? space.espacioId : null,
      );
      const fingerprint = orderFingerprint(payload);
      const key = idempotencyKeyFor(fingerprint);
      const order = await api.createOrder(session.access_token, payload, key);
      rememberPickupQrToken(order.id, order.qr_token);
      if (payment === 'stripe') {
        const stripeSession = stripeSessionFromCreatedOrder(order);
        rememberStripeCheckoutSession(order.id, stripeSession);
        savePendingStripeOrderId(order.id);
      }
      reset();
      if (destination === 'en_espacio') clearSpace();
      forgetIdempotencyKey(fingerprint);
      void navigate(`/cuenta/pedidos/${order.id}`);
    } catch (cause) {
      if (cause instanceof VaiinillaApiError && cause.code === 'IDENTITY_NOT_REGISTERED') {
        void navigate(`/cuenta?next=/e/${slug}/carrito`);
        return;
      }
      setError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell tab="cart">
      <main id="main-content" className="alumno-main">
        <AlumnoPageHeader kicker="Revisa y confirma" title="Tu pedido" />
        {error ? <p className="alumno-error">{error}</p> : null}
        {blocker ? <p className="alumno-banner alumno-banner--coral">{blocker}</p> : null}
        {pendingStripeOrderId ? (
          <p className="alumno-banner">
            Tienes un pago Stripe pendiente.{' '}
            <Link to={`/cuenta/pedidos/${pendingStripeOrderId}`}>Revisar pago pendiente</Link>
          </p>
        ) : null}
        {lines.length === 0 ? (
          <div className="alumno-cart-empty">
            <div className="alumno-empty">
              <div className="alumno-antojo" aria-hidden="true">
                <span className="alumno-antojo__deco alumno-antojo__deco--note">
                  <NoteIcon />
                </span>
                <span className="alumno-antojo__q">
                  <span className="alumno-antojo__q-face">?</span>
                </span>
                <img className="alumno-antojo__vaini" src="/vaini/cutout-frente.png" alt="" />
                <span className="alumno-antojo__deco alumno-antojo__deco--cup">
                  <CupIcon />
                </span>
                <span className="alumno-antojo__deco alumno-antojo__deco--spark">✦</span>
              </div>
              <div className="alumno-empty__copy">
                <h2>¿Qué se te antoja?</h2>
                <p className="alumno-lead">Pide algo del menú y aparece aquí.</p>
                <Link className="alumno-btn alumno-btn--lime" to={`/e/${slug}`}>
                  Ver menú
                </Link>
              </div>
            </div>
            {previousOrders.length > 0 ? (
              <section className="alumno-history" aria-labelledby="prev-orders">
                <h2 className="alumno-section-label" id="prev-orders">
                  Pedidos anteriores
                </h2>
                <div className="alumno-history-list">
                {previousOrders.map((order) => (
                  <Link className="alumno-history-row" key={order.id} to={`/cuenta/pedidos/${order.id}`}>
                    <span>
                      <strong>{orderHistoryHeadline(order)}</strong>
                      <p>#{order.folio} · Entregado</p>
                    </span>
                    <span className="alumno-history-row__price">{formatAmount(order.total)}</span>
                    <span className="alumno-history-row__chev" aria-hidden="true">
                      ›
                    </span>
                  </Link>
                ))}
                </div>
              </section>
            ) : (
              <aside className="alumno-cart-peek" aria-labelledby="menu-peek" data-peek-count={menuPeek.length}>
                <h2 className="alumno-section-label" id="menu-peek">
                  Del menú
                </h2>
                {menuPeek.length > 0 ? (
                  <>
                    {menuPeek.map((product) => {
                      const thumb = productImageUrl(product.imagen_url);
                      return (
                      <Link className="alumno-cart-peek__row" key={product.id} to={`/e/${slug}`}>
                        {thumb ? (
                          <img src={thumb} alt="" />
                        ) : (
                          <span className="alumno-cart-peek__vaini" aria-hidden="true">
                            <img src="/vaini/cutout-frente.png" alt="" />
                          </span>
                        )}
                        <span>
                          <strong>{product.nombre}</strong>
                          <p>{formatAmount(product.precio_digital)}</p>
                        </span>
                      </Link>
                      );
                    })}
                    <Link className="alumno-link" to={`/e/${slug}`}>
                      Ver todo el menú
                    </Link>
                  </>
                ) : (
                  <>
                    <div className="alumno-cart-peek__art" aria-hidden="true">
                      <img src="/vaini/scene-laptop.png" alt="" />
                    </div>
                    <p className="alumno-cart-peek__idle">
                      Abre el menú y arma tu pedido. Las sugerencias y tus anteriores aparecen aquí.
                    </p>
                    <Link className="alumno-btn alumno-btn--lime" to={`/e/${slug}`}>
                      Ir al menú
                    </Link>
                  </>
                )}
              </aside>
            )}
          </div>
        ) : (
          <>
            <div className="alumno-cart-layout">
              <div className="alumno-cart-layout__lines">
            {lines.map((line) => (
              <div className="alumno-line" key={`${line.productId}-${line.optionIds.join(',')}`}>
                {line.imageUrl ? (
                  <img src={line.imageUrl} alt="" />
                ) : (
                  <div className="alumno-line__ph" />
                )}
                <div>
                  <strong>{line.productName}</strong>
                  <p className="alumno-muted">{formatMoney(line.unitPreview)} c/u</p>
                  <div className="alumno-qty">
                    <button
                      type="button"
                      aria-label={`Quitar una ${line.productName}`}
                      onClick={() => updateQuantity(line.productId, line.optionIds, line.quantity - 1)}
                    >
                      −
                    </button>
                    <span>{line.quantity}</span>
                    <button
                      type="button"
                      aria-label={`Agregar una ${line.productName}`}
                      onClick={() => updateQuantity(line.productId, line.optionIds, line.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
                <button className="alumno-link" type="button" onClick={() => removeLine(line.productId, line.optionIds)}>
                  Quitar
                </button>
              </div>
            ))}
              </div>
              <aside className="alumno-cart-layout__side">
            <button
              type="button"
              className="alumno-card"
              onClick={() => {
                if (space) setForHere((value) => !value);
              }}
            >
              <h2>{forHere && space ? space.nombre : 'Para llevar'}</h2>
              <p className="alumno-muted">
                {forHere && space
                  ? 'El pedido se entrega en tu mesa. Toca para cambiar a para llevar.'
                  : space
                    ? `Toca para pedir en ${space.nombre}.`
                    : 'Recoges en mostrador cuando esté listo.'}
              </p>
            </button>
            {place?.identificador_cliente_obligatorio ? (
              <label className="alumno-field">
                {place.identificador_cliente_etiqueta}
                <input
                  value={clientId}
                  onChange={(event) => setClientId(event.target.value)}
                  required
                  autoComplete="off"
                />
              </label>
            ) : null}
            <label className="alumno-field">
              Nota para cocina
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
            </label>
            <p>
              <strong>Total {total ? formatMoney(total) : '—'}</strong>
            </p>
              <div className="alumno-sticky-pay">
                <button
                  className="alumno-btn alumno-btn--lime"
                  type="button"
                  disabled={
                    !ready ||
                    operationalVerificationPending ||
                    Boolean(blocker) ||
                    Boolean(pendingStripeOrderId)
                  }
                  onClick={() =>
                    canCheckout ? setSheetOpen(true) : void navigate(`/cuenta?next=/e/${slug}/carrito`)
                  }
                >
                  {canCheckout
                    ? operationalVerificationPending
                      ? 'Verificando…'
                      : 'Pagar'
                    : 'Entra para pagar'}
                </button>
              </div>
              </aside>
            </div>
          </>
        )}
      </main>
      {sheetOpen ? (
        <div className="alumno-sheet alumno-sheet--pay" role="dialog" aria-labelledby="pay-title">
          <div className="alumno-sheet__panel">
            <h2 id="pay-title">¿Cómo quieres pagar?</h2>
            <p className="alumno-muted" style={{ margin: '6px 0 14px' }}>
              Total {total ? formatMoney(total) : '—'}
            </p>
            <button
              type="button"
              className={payment === 'efectivo' ? 'alumno-pay-row is-on' : 'alumno-pay-row'}
              onClick={() => setPayment('efectivo')}
            >
              <span>
                <strong>Efectivo al recoger</strong>
                <p className="alumno-muted">Pagas en caja cuando el pedido esté listo.</p>
              </span>
            </button>
            {user ? (
              <button
                type="button"
                className={payment === 'saldo' ? 'alumno-pay-row is-on' : 'alumno-pay-row'}
                onClick={() => setPayment('saldo')}
              >
                <span>
                  <strong>Saldo</strong>
                  <p className="alumno-muted">
                    {wallet ? `Disponible: ${formatMoney(wallet.wallet.saldo)}` : 'Entra a tu cuenta para ver el saldo.'}
                  </p>
                </span>
              </button>
            ) : null}
            <button
              type="button"
              className={payment === 'stripe' ? 'alumno-pay-row is-on' : 'alumno-pay-row'}
              disabled={!stripeEnabled}
              onClick={() => stripeEnabled && setPayment('stripe')}
            >
              <span>
                <strong>Tarjeta</strong>
                <p className="alumno-muted">{stripeEnabled ? 'Pagas con Stripe.' : STRIPE_UNAVAILABLE_COPY}</p>
              </span>
            </button>
            {error ? <p className="alumno-error">{error}</p> : null}
            {insufficientBalance ? <p className="alumno-error">No tienes saldo suficiente para este pedido.</p> : null}
            <button
              className="alumno-btn alumno-btn--lime"
              type="button"
              disabled={submitting || Boolean(insufficientBalance) || Boolean(pendingStripeOrderId)}
              onClick={() => void confirm()}
            >
              {submitting ? 'Confirmando…' : 'Confirmar'}
            </button>
            <button className="alumno-btn alumno-btn--ghost" type="button" onClick={() => setSheetOpen(false)}>
              Cerrar
            </button>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function NoteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 3h8l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm8 1.8V9h4.2L15 4.8ZM8 12h8v1.6H8V12Zm0 4h8v1.6H8V16Z"
      />
    </svg>
  );
}

function CupIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 10h13v4.5A4.5 4.5 0 0 1 12.5 19h-4A4.5 4.5 0 0 1 4 14.5V10Zm13 1.2h1.6A2.4 2.4 0 0 1 21 13.6 2.4 2.4 0 0 1 18.6 16H17v-1.6h1.6a.8.8 0 0 0 .8-.8.8.8 0 0 0-.8-.8H17V11.2ZM7 4.5c.6.7 1 1.6 1 2.6S7.6 8.7 7 9.4c-.6-.7-1-1.6-1-2.3s.4-1.9 1-2.6Zm3.2 0c.6.7 1 1.6 1 2.6s-.4 1.6-1 2.3c-.6-.7-1-1.6-1-2.3s.4-1.9 1-2.6Z"
      />
    </svg>
  );
}
