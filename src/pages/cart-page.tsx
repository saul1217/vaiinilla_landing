import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/app-shell';
import { useAuth } from '../context/auth-context';
import { useBuyerSession } from '../context/buyer-session';
import { useCart } from '../context/cart-context';
import { api } from '../lib/api';
import { errorMessage, VaiinillaApiError } from '../lib/api-error';
import { cartTotal, isOperationallyReady, toCreateOrderInput } from '../lib/cart';
import { forgetIdempotencyKey, idempotencyKeyFor, orderFingerprint } from '../lib/idempotency';
import { formatMoney, moneyToCents } from '../lib/money';
import { clearSpace, readSpace } from '../lib/space-session';
import { isStripeCheckoutEnabled, STRIPE_UNAVAILABLE_COPY } from '../lib/stripe-public';
import { ESTABLISHMENT_CLOSED_MESSAGE } from '../types/api';
import type { OperationalStatus, PaymentMethod, PublicEstablishment, WalletData } from '../types/api';

export function CartPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { cart, updateQuantity, removeLine, reset } = useCart();
  const { user, ready } = useAuth();
  const { context, openClientSession } = useBuyerSession();
  const [place, setPlace] = useState<PublicEstablishment | null>(null);
  const [status, setStatus] = useState<OperationalStatus | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [payment, setPayment] = useState<PaymentMethod>('efectivo');
  const [notes, setNotes] = useState('');
  const [clientId, setClientId] = useState(
    () => sessionStorage.getItem(`vaiinilla.buyer.client-id.${slug}`) ?? '',
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const space = readSpace(slug);
  const [forHere, setForHere] = useState(Boolean(space));
  const stripeEnabled = isStripeCheckoutEnabled();

  const lines = useMemo(() => (cart?.slug === slug ? cart.lines : []), [cart, slug]);
  const total = useMemo(() => cartTotal(lines), [lines]);

  useEffect(() => {
    let active = true;
    void api
      .getEstablishment(slug)
      .then((next) => {
        if (active) setPlace(next);
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!context || !place || context.contexto.establecimiento_id !== place.id) return;
    let active = true;
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
        if (active) setError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [context, place]);

  const operationalReady = isOperationallyReady(status);
  const blocker =
    lines.length === 0
      ? null
      : status
        ? operationalReady
          ? null
          : ESTABLISHMENT_CLOSED_MESSAGE
        : context
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
      void navigate(`/cuenta?next=/e/${slug}/carrito`);
      return;
    }
    if (payment === 'stripe' && !stripeEnabled) {
      setError(STRIPE_UNAVAILABLE_COPY);
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
      if (payment === 'stripe') {
        const checkout = await api.createStripePayment(session.access_token, order.id);
        if (checkout.url) {
          window.location.assign(checkout.url);
          return;
        }
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
        <p className="alumno-kicker">Pedido</p>
        <h1>Tu pedido</h1>
        {error ? <p className="alumno-error">{error}</p> : null}
        {blocker ? <p className="alumno-banner alumno-banner--coral">{blocker}</p> : null}
        {lines.length === 0 ? (
          <div className="alumno-empty">
            <img src="/vaini/cutout-frente.png" alt="" />
            <h2>Tu carrito está vacío</h2>
            <p className="alumno-lead">Arma tu pedido del menú de hoy.</p>
            <Link className="alumno-btn alumno-btn--lime" to={`/e/${slug}`}>
              Explorar menú
            </Link>
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
                  disabled={!ready || Boolean(blocker)}
                  onClick={() => (user ? setSheetOpen(true) : void navigate(`/cuenta?next=/e/${slug}/carrito`))}
                >
                  {user ? 'Pagar' : 'Entra para pagar'}
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
            {insufficientBalance ? <p className="alumno-error">No tienes saldo suficiente para este pedido.</p> : null}
            <button
              className="alumno-btn alumno-btn--lime"
              type="button"
              disabled={submitting || Boolean(insufficientBalance)}
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
