import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { MenuPeek } from '../components/menu-peek';
import { useAuth } from '../context/auth-context';
import { useBuyerSession } from '../context/buyer-session';
import { useCart } from '../context/cart-context';
import { api } from '../lib/api';
import { errorMessage, VaiinillaApiError } from '../lib/api-error';
import { canAcceptOrders, cartTotal, toCreateOrderInput } from '../lib/cart';
import { leftoverPeekProducts, peekCatalogProducts, productImageUrl } from '../lib/catalog-images';
import { forgetIdempotencyKey, idempotencyKeyFor, orderFingerprint } from '../lib/idempotency';
import { formatAmount, formatMoney, linePreview, moneyToCents } from '../lib/money';
import { resolveClientSession } from '../lib/client-session';
import { lastPlaceSlug } from '../lib/last-place';
import { orderHistoryHeadline } from '../lib/order-labels';
import { rememberPickupQrToken } from '../lib/pickup-qr';
import { clearSpace, readSpace } from '../lib/space-session';
import { readPendingStripeOrderId, savePendingStripeOrderId } from '../lib/stripe-pending';
import { isStripeCheckoutEnabled, STRIPE_UNAVAILABLE_COPY } from '../lib/stripe-public';
import { rememberStripeCheckoutSession, stripeSessionFromCreatedOrder } from '../lib/stripe-session';
import { isGuestBuy } from '../lib/guest-explore';
import { GUEST_CHECKOUT_UNAVAILABLE } from '../lib/guest-checkout';
import type { SpaceSession } from '../lib/space-session';
import type {
  CartLine,
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
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const menuPeek = useMemo(() => peekCatalogProducts(catalogProducts), [catalogProducts]);
  const space = readSpace(slug);
  const [forHere, setForHere] = useState(Boolean(space));
  const stripeEnabled = isStripeCheckoutEnabled();
  const pendingStripeOrderId = readPendingStripeOrderId();
  const guestBuy = isGuestBuy();
  const canCheckout = Boolean(user) || guestBuy;

  const lines = useMemo(() => (cart?.slug === slug ? cart.lines : []), [cart, slug]);
  const leftoverPeek = useMemo(
    () => leftoverPeekProducts(catalogProducts, lines.map((line) => line.productId)),
    [catalogProducts, lines],
  );
  const total = useMemo(() => cartTotal(lines), [lines]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      api.getEstablishment(slug),
      api.getGuestCatalog(slug).catch(() => ({ categorias: [], productos: [] })),
    ])
      .then(([next, catalog]) => {
        const products = Array.isArray(catalog?.productos) ? catalog.productos : [];
        if (!active) return;
        setCatalogProducts(products);
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
    if (!ready) return;
    if (!user) {
      setPreviousOrders([]);
      setHistoryLoading(false);
      setHistoryError(null);
      return;
    }
    let active = true;
    setHistoryLoading(true);
    setHistoryError(null);
    const run = async () => {
      try {
        const resolved = await resolveClientSession({
          user,
          context,
          preferredSlug: slug || lastPlaceSlug(),
          openClientSession: openClientSessionRef.current,
        });
        if (!resolved) {
          if (active) setPreviousOrders([]);
          return;
        }
        const result = await api.listOrders(resolved.context.access_token);
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
        setHistoryError(null);
      } catch (cause) {
        if (active) {
          setPreviousOrders([]);
          setHistoryError(errorMessage(cause));
        }
      } finally {
        if (active) setHistoryLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [context, place, ready, slug, user]);

  const hasMatchingContext = Boolean(
    context && place && context.contexto.establecimiento_id === place.id,
  );
  const operationalVerificationPending = hasMatchingContext && !status && !operationalError;
  const blocker =
    lines.length === 0
      ? null
      : status
        ? canAcceptOrders(status)
          ? null
          : 'El establecimiento no está recibiendo pedidos en este momento.'
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
      if (!canAcceptOrders(operational)) {
        throw new Error('El establecimiento no está recibiendo pedidos en este momento.');
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
          <CartEmptyView
            slug={slug}
            previousOrders={previousOrders}
            historyLoading={Boolean(user) && historyLoading}
            historyError={historyError}
            menuPeek={menuPeek}
          />
        ) : (
          <CartFilledView
            lines={lines}
            onUpdateQuantity={updateQuantity}
            onRemoveLine={removeLine}
            forHere={forHere}
            space={space}
            onToggleDestination={() => {
              if (space) setForHere((value) => !value);
            }}
            place={place}
            clientId={clientId}
            onClientIdChange={setClientId}
            notes={notes}
            onNotesChange={setNotes}
            total={total}
            slug={slug}
            menuPeek={leftoverPeek}
            payLabel={
              canCheckout
                ? operationalVerificationPending
                  ? 'Verificando…'
                  : 'Pagar'
                : 'Entra para pagar'
            }
            payDisabled={
              !ready ||
              operationalVerificationPending ||
              Boolean(blocker) ||
              Boolean(pendingStripeOrderId)
            }
            onPay={() =>
              canCheckout ? setSheetOpen(true) : void navigate(`/cuenta?next=/e/${slug}/carrito`)
            }
          />
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
                <p className="alumno-muted">
                  {stripeEnabled
                    ? 'Pagas con Stripe. El total final lo calcula Vaiinilla al crear el pedido antes de abrir Stripe.'
                    : STRIPE_UNAVAILABLE_COPY}
                </p>
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

export function CartFilledView({
  lines,
  onUpdateQuantity,
  onRemoveLine,
  forHere,
  space,
  onToggleDestination,
  place,
  clientId,
  onClientIdChange,
  notes,
  onNotesChange,
  total,
  payLabel,
  payDisabled,
  onPay,
  slug,
  menuPeek = [],
}: {
  lines: CartLine[];
  onUpdateQuantity: (productId: number, optionIds: number[], quantity: number) => void;
  onRemoveLine: (productId: number, optionIds: number[]) => void;
  forHere: boolean;
  space: SpaceSession | null;
  onToggleDestination: () => void;
  place: PublicEstablishment | null;
  clientId: string;
  onClientIdChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  total: string | null;
  payLabel: string;
  payDisabled: boolean;
  onPay: () => void;
  slug?: string;
  menuPeek?: CatalogProduct[];
}) {
  return (
    <div className="alumno-cart-layout">
      <div className="alumno-cart-layout__lines">
        {lines.map((line) => {
          const thumb = productImageUrl(line.imageUrl);
          const lineTotal = linePreview(line.unitPreview, line.quantity);
          return (
            <div className="alumno-line" key={`${line.productId}-${line.optionIds.join(',')}`}>
              {thumb ? (
                <img className="alumno-line__thumb" src={thumb} alt="" />
              ) : (
                <div className="alumno-line__thumb alumno-line__thumb--vaini" aria-hidden="true">
                  <img src="/vaini/cutout-frente.png" alt="" />
                </div>
              )}
              <div className="alumno-line__copy">
                <strong>{line.productName}</strong>
                <p>{formatAmount(line.unitPreview)} c/u</p>
                <div className="alumno-qty">
                  <button
                    type="button"
                    aria-label={`Quitar una ${line.productName}`}
                    onClick={() => onUpdateQuantity(line.productId, line.optionIds, line.quantity - 1)}
                  >
                    −
                  </button>
                  <span>{line.quantity}</span>
                  <button
                    type="button"
                    aria-label={`Agregar una ${line.productName}`}
                    onClick={() => onUpdateQuantity(line.productId, line.optionIds, line.quantity + 1)}
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="alumno-line__side">
                <span className="alumno-line__price">{lineTotal ? formatAmount(lineTotal) : '—'}</span>
                <button
                  className="alumno-line__remove"
                  type="button"
                  onClick={() => onRemoveLine(line.productId, line.optionIds)}
                >
                  Quitar
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <aside className="alumno-cart-layout__side">
        <div className="alumno-cart-layout__checkout">
          <button type="button" className="alumno-card" onClick={onToggleDestination}>
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
                onChange={(event) => onClientIdChange(event.target.value)}
                required
                autoComplete="off"
              />
            </label>
          ) : null}
          <label className="alumno-field">
            Nota para cocina
            <textarea value={notes} onChange={(event) => onNotesChange(event.target.value)} rows={2} />
          </label>
          <div className="alumno-cart-layout__pay">
            <p className="alumno-cart-layout__total">
              <strong>Total {total ? formatAmount(total) : '—'}</strong>
            </p>
            <div className="alumno-sticky-pay">
              <button className="alumno-btn alumno-btn--lime" type="button" disabled={payDisabled} onClick={onPay}>
                {payLabel}
              </button>
            </div>
          </div>
        </div>
      </aside>
      {slug ? (
        <MenuPeek slug={slug} products={menuPeek} headingId="filled-menu-peek" emptyMode="compact" />
      ) : null}
    </div>
  );
}

export function CartEmptyView({
  slug,
  previousOrders,
  menuPeek,
  historyLoading = false,
  historyError = null,
}: {
  slug: string;
  previousOrders: OrderDetail[];
  menuPeek: CatalogProduct[];
  historyLoading?: boolean;
  historyError?: string | null;
}) {
  const showHistory = previousOrders.length > 0;
  const showHistorySection = historyLoading || Boolean(historyError) || showHistory;
  const showPeek = menuPeek.length > 0 || !showHistory;
  const showRail = showHistorySection || showPeek;

  return (
    <div className="alumno-cart-empty">
      <div className="alumno-empty">
        <div className="alumno-antojo" aria-hidden="true">
          <span className="alumno-antojo__deco alumno-antojo__deco--note">
            <NoteIcon />
          </span>
          <img
            className="alumno-antojo__hug"
            src="/vaini/cutout-hug-question.png"
            alt=""
            width={511}
            height={408}
            decoding="async"
            fetchPriority="high"
          />
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
      {showRail ? (
        <div className="alumno-cart-empty__rail">
          {showHistorySection ? (
            <section
              className="alumno-history"
              {...(showHistory
                ? { 'aria-labelledby': 'prev-orders' }
                : { 'aria-label': 'Pedidos anteriores' })}
            >
              {showHistory ? (
                <h2 className="alumno-section-label" id="prev-orders">
                  Pedidos anteriores
                </h2>
              ) : null}
              {historyLoading ? <p role="status">Cargando pedidos anteriores…</p> : null}
              {historyError ? <p className="alumno-error">{historyError}</p> : null}
              {showHistory ? (
                <div className="alumno-history-list">
                  {previousOrders.map((order) => (
                    <Link className="alumno-history-row" key={order.id} to={`/cuenta/pedidos/${order.id}`}>
                      <span>
                        <strong>{orderHistoryHeadline(order)}</strong>
                        <p>#{order.folio} · Entregado</p>
                      </span>
                      <span className="alumno-history-row__price">{formatAmount(order.total)}</span>
                      <span className="alumno-history-row__chev" aria-hidden="true">
                        {'>'}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
          {showPeek ? <MenuPeek slug={slug} products={menuPeek} /> : null}
        </div>
      ) : null}
    </div>
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
