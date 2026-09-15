import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageShell } from '../components/shell';
import { useAuth } from '../context/auth-context';
import { useBuyerSession } from '../context/buyer-session';
import { useCart } from '../context/cart-context';
import { api } from '../lib/api';
import { errorMessage, VaiinillaApiError } from '../lib/api-error';
import { cartTotal, isOperationallyReady, toCreateOrderInput } from '../lib/cart';
import { createIdempotencyKey, orderFingerprint } from '../lib/idempotency';
import { formatMoney, moneyToCents } from '../lib/money';
import { ESTABLISHMENT_CLOSED_MESSAGE } from '../types/api';
import type { OperationalStatus, PublicEstablishment, WalletData } from '../types/api';

const pendingKeys = new Map<string, string>();

export function CartPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { cart, updateQuantity, removeLine, reset } = useCart();
  const { user, ready } = useAuth();
  const { context, openClientSession } = useBuyerSession();
  const [place, setPlace] = useState<PublicEstablishment | null>(null);
  const [status, setStatus] = useState<OperationalStatus | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [payment, setPayment] = useState<'efectivo' | 'saldo'>('efectivo');
  const [notes, setNotes] = useState('');
  const [clientId, setClientId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    ]).then(([nextStatus, nextWallet]) => {
      if (!active) return;
      setStatus(nextStatus);
      setWallet(nextWallet);
    }).catch((cause: unknown) => {
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
    setSubmitting(true);
    try {
      const session =
        context?.contexto.establecimiento_id === place.id
          ? context
          : await openClientSession(user, place, clientId || undefined);
      const operational = await api.getOperationalStatus(session.access_token);
      setStatus(operational);
      if (!isOperationallyReady(operational)) {
        throw new Error(ESTABLISHMENT_CLOSED_MESSAGE);
      }
      const payload = toCreateOrderInput(lines, payment, notes);
      const fingerprint = orderFingerprint(payload);
      const key = pendingKeys.get(fingerprint) ?? createIdempotencyKey();
      pendingKeys.set(fingerprint, key);
      const order = await api.createOrder(session.access_token, payload, key);
      reset();
      pendingKeys.delete(fingerprint);
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
    <PageShell>
      <main id="main-content" className="app-page">
        <div className="container">
          <p className="eyebrow">Carrito</p>
          <h1>{place?.nombre ?? cart?.establishmentName ?? 'Pedido'}</h1>
          <p className="app-lead">Entrega para llevar. El total es una vista previa; el backend confirma el cobro.</p>
          {error ? <p className="feedback">{error}</p> : null}
          {blocker ? <p className="feedback">{blocker}</p> : null}
          {lines.length === 0 ? (
            <div className="empty-state">
              Tu carrito está vacío. <Link to={`/e/${slug}`}>Volver al menú</Link>
            </div>
          ) : (
            <>
              {lines.map((line) => (
                <div className="cart-line" key={`${line.productId}-${line.optionIds.join(',')}`}>
                  <div>
                    <strong>{line.productName}</strong>
                    <p className="muted">{formatMoney(line.unitPreview)} c/u</p>
                  </div>
                  <div className="qty">
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
                    <button className="btn btn--ghost" type="button" onClick={() => removeLine(line.productId, line.optionIds)}>
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
              <p>
                <strong>Total estimado: {total ? formatMoney(total) : '—'}</strong>
              </p>
              {place?.identificador_cliente_obligatorio ? (
                <label className="field">
                  {place.identificador_cliente_etiqueta}
                  <input
                    value={clientId}
                    onChange={(event) => setClientId(event.target.value)}
                    required
                    autoComplete="off"
                  />
                </label>
              ) : null}
              <label className="field">
                Notas para cocina
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
              </label>
              <div className="pay-choice" role="radiogroup" aria-label="Método de pago">
                <label className={payment === 'efectivo' ? 'is-on' : undefined}>
                  <input
                    type="radio"
                    name="pago"
                    checked={payment === 'efectivo'}
                    onChange={() => setPayment('efectivo')}
                  />
                  <span>
                    <strong>Efectivo al recoger</strong>
                    <p>Pagas en caja cuando el pedido esté listo.</p>
                  </span>
                </label>
                <label className={payment === 'saldo' ? 'is-on' : undefined}>
                  <input
                    type="radio"
                    name="pago"
                    checked={payment === 'saldo'}
                    onChange={() => setPayment('saldo')}
                  />
                  <span>
                    <strong>Saldo</strong>
                    <p>
                      {wallet
                        ? `Disponible: ${formatMoney(wallet.wallet.saldo)}`
                        : 'Entra a tu cuenta para ver el saldo de esta cafetería.'}
                    </p>
                  </span>
                </label>
              </div>
              {insufficientBalance ? <p className="feedback">No tienes saldo suficiente para este pedido.</p> : null}
              <button
                className="btn btn--primary"
                type="button"
                disabled={submitting || !ready || Boolean(blocker) || Boolean(insufficientBalance)}
                onClick={() => void confirm()}
              >
                {user ? (submitting ? 'Confirmando…' : 'Confirmar pedido') : 'Entra para confirmar'}
              </button>
            </>
          )}
        </div>
      </main>
    </PageShell>
  );
}
