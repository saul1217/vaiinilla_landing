import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
// `pure` no inserta Stripe.js al importar: se carga solo cuando se va a cobrar.
import { loadStripe } from '@stripe/stripe-js/pure';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { LoadingSkeleton } from '../components/loading-skeleton';
import { useAuth } from '../context/auth-context';
import { useBuyerSession } from '../context/buyer-session';
import { useCart } from '../context/cart-context';
import { api } from '../lib/api';
import { errorMessage } from '../lib/api-error';
import { resolveClientSession } from '../lib/client-session';
import { walletQrUrl } from '../lib/env';
import { createIdempotencyKey } from '../lib/idempotency';
import { lastPlaceSlug } from '../lib/last-place';
import { formatAmount } from '../lib/money';
import { stripePublishableKey } from '../lib/stripe-public';
import {
  CASH_RELOAD_POLL_MS,
  QUICK_RELOAD_AMOUNTS,
  cashReloadArrived,
  centsLabel,
  isCardReloadTestMode,
  parseReloadAmount,
  reloadAmountProblem,
  reloadExtraCharge,
  reloadRangeLabel,
  reloadRangeOf,
  resolveTestStripeKey,
  waitForCardReload,
  walletRechargeNote,
} from '../lib/wallet-reload';
import type { CardReloadCheckout, WalletData } from '../types/api';
import '../styles/wallet-reload.css';

type Method = 'card' | 'cash';

type CardPhase =
  | { kind: 'editing' }
  | { kind: 'starting' }
  | { kind: 'review'; checkout: CardReloadCheckout }
  | { kind: 'paying'; checkout: CardReloadCheckout }
  | { kind: 'confirming'; reloadId: string }
  | { kind: 'in_review'; reloadId: string }
  | { kind: 'credited'; amount: string }
  | { kind: 'failed'; message: string };

export const CARD_RELOAD_NOTE =
  'Pago seguro con Stripe (modo de prueba) · cuándo llega el saldo depende del banco. Es para usar en este lugar.';

/**
 * Recargar Mi saldo, como en Android: en Caja con el QR personal (la pantalla espera a que Caja recargue)
 * o con tarjeta. La tarjeta solo se ofrece en modo de prueba de Stripe.
 */
export function WalletReloadPage({
  pollMs = CASH_RELOAD_POLL_MS,
  cardPollMs,
}: { pollMs?: number; cardPollMs?: number } = {}) {
  const { user, ready } = useAuth();
  const { cart } = useCart();
  const { context, openClientSession } = useBuyerSession();
  const [params, setParams] = useSearchParams();
  const resumeId = params.get('recarga');
  const [token, setToken] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [placeName, setPlaceName] = useState('');
  const [acceptsCard, setAcceptsCard] = useState(false);
  const [allowsBalance, setAllowsBalance] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cardTestMode = useMemo(() => isCardReloadTestMode({ apiUrl: api.apiUrl }), []);
  const offersCard = cardTestMode && acceptsCard;
  const [method, setMethod] = useState<Method>(resumeId ? 'card' : 'cash');

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const resolved = await resolveClientSession({
          user,
          context,
          preferredSlug: cart?.slug ?? lastPlaceSlug(),
          openClientSession,
        });
        if (!resolved) {
          if (active) setError('Entra a un establecimiento para recargar el saldo de ese lugar.');
          return;
        }
        const accessToken = resolved.context.access_token;
        const [next, place] = await Promise.all([
          api.getMyWallet(accessToken),
          resolved.place
            ? Promise.resolve(resolved.place)
            : resolved.slug
              ? api.getEstablishment(resolved.slug).catch(() => null)
              : Promise.resolve(null),
        ]);
        if (!active) return;
        setToken(accessToken);
        setWallet(next);
        setPlaceName(place?.nombre ?? '');
        setAcceptsCard(place?.acepta_tarjeta === true);
        setAllowsBalance(place?.permite_saldo !== false);
        setError(null);
      } catch (cause) {
        if (active) setError(errorMessage(cause));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [cart?.slug, context, openClientSession, ready, user]);

  const refreshWallet = useCallback(async () => {
    if (!token) return null;
    const next = await api.getMyWallet(token);
    setWallet(next);
    return next;
  }, [token]);

  const clearResume = useCallback(() => {
    if (!params.has('recarga')) return;
    const next = new URLSearchParams(params);
    next.delete('recarga');
    next.delete('payment_intent');
    next.delete('payment_intent_client_secret');
    next.delete('redirect_status');
    setParams(next, { replace: true });
  }, [params, setParams]);

  if (ready && !user) return <Navigate to="/cuenta?next=/cuenta/saldo/recargar" replace />;

  const frozen = wallet?.wallet.saldo_congelado === true;
  const note = wallet ? walletRechargeNote({ frozen, allowsBalance }) : null;
  const userId = wallet?.wallet.usuario_id || wallet?.cliente.usuario_id || '';
  const activeMethod: Method = offersCard ? method : 'cash';

  return (
    <AppShell tab="wallet">
      <main id="main-content" className="alumno-main wallet-reload">
        <AlumnoPageHeader
          kicker={placeName ? `Saldo en ${placeName}` : 'Saldo Vaiinilla'}
          title="Recargar saldo"
          back={{ to: '/cuenta/saldo', label: 'Mi saldo' }}
        />
        {error ? <p className="alumno-error">{error}</p> : null}
        {loading && !wallet && !error ? <LoadingSkeleton shape="wallet" label="Cargando saldo…" /> : null}
        {wallet ? (
          <>
            <section className="alumno-card wallet-reload__balance" aria-label="Saldo actual">
              <p className="alumno-muted">Tienes</p>
              <p className="alumno-wallet-balance" data-testid="wallet-reload-balance">
                {formatAmount(wallet.wallet.saldo, 'always')}
              </p>
            </section>
            {note ? (
              <p className="alumno-muted" role="note">
                {note}
              </p>
            ) : (
              <>
                {offersCard ? (
                  <div className="wallet-reload__methods" role="tablist" aria-label="Cómo recargar">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeMethod === 'card'}
                      className={`alumno-chip${activeMethod === 'card' ? ' is-on' : ''}`}
                      onClick={() => setMethod('card')}
                    >
                      Con tarjeta
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeMethod === 'cash'}
                      className={`alumno-chip${activeMethod === 'cash' ? ' is-on' : ''}`}
                      onClick={() => setMethod('cash')}
                    >
                      En Caja
                    </button>
                  </div>
                ) : null}
                {activeMethod === 'card' && token ? (
                  <CardReloadPanel
                    token={token}
                    wallet={wallet}
                    resumeId={resumeId}
                    pollMs={cardPollMs}
                    onSettled={() => {
                      clearResume();
                      void refreshWallet().catch(() => undefined);
                    }}
                  />
                ) : null}
                {activeMethod === 'cash' && userId ? (
                  <CashReloadPanel
                    userId={userId}
                    holderName={wallet.cliente.nombre}
                    placeName={placeName}
                    balance={wallet.wallet.saldo}
                    pollMs={pollMs}
                    refresh={refreshWallet}
                  />
                ) : null}
              </>
            )}
          </>
        ) : null}
      </main>
    </AppShell>
  );
}

/** «Recargar en Caja» (Android: WalletReloadCodeSheet): el QR personal y, al llegar la recarga, se avisa solo. */
export function CashReloadPanel({
  userId,
  holderName,
  placeName,
  balance,
  pollMs = CASH_RELOAD_POLL_MS,
  refresh,
}: {
  userId: string;
  holderName?: string;
  placeName?: string;
  balance: string;
  pollMs?: number;
  refresh: () => Promise<WalletData | null>;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [arrived, setArrived] = useState<string | null>(null);
  const startBalance = useRef(balance);

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(walletQrUrl(userId), { margin: 1, width: 320 })
      .then((url) => {
        if (active) setQr(url);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (arrived) return;
    const timer = window.setInterval(() => {
      void refresh()
        .then((next) => {
          const amount = cashReloadArrived(startBalance.current, next?.wallet.saldo);
          if (amount) setArrived(amount);
        })
        .catch(() => undefined);
    }, pollMs);
    return () => window.clearInterval(timer);
  }, [arrived, pollMs, refresh]);

  if (arrived) {
    return (
      <section className="alumno-card wallet-reload__done" role="status">
        <h2>Listo, Caja te recargó {formatAmount(arrived)}</h2>
        <Link className="alumno-btn alumno-btn--lime" to="/cuenta/saldo">
          Ir a mi saldo
        </Link>
      </section>
    );
  }

  return (
    <section className="alumno-card alumno-card--qr wallet-reload__cash" aria-labelledby="wallet-reload-cash">
      <h2 id="wallet-reload-cash">Recargar en Caja</h2>
      <p className="alumno-muted">
        Muestra este QR en Caja{placeName ? ` de ${placeName}` : ''} para encontrar tu cuenta y recargar Saldo
        Vaiinilla. Paga en efectivo y el saldo llega aquí.
      </p>
      {qr ? <img className="wallet-qr" src={qr} alt="Código para identificar tu saldo" /> : null}
      {holderName ? <p className="wallet-reload__holder">{holderName}</p> : null}
      <p className="alumno-muted" role="status">
        Esperando la recarga…
      </p>
    </section>
  );
}

/** Recargar con tarjeta (Android: ChildReloadSheet): monto → total con comisión → Stripe → el backend confirma. */
export function CardReloadPanel({
  token,
  wallet,
  resumeId,
  pollMs,
  onSettled,
}: {
  token: string;
  wallet: WalletData;
  resumeId?: string | null;
  pollMs?: number;
  onSettled?: () => void;
}) {
  const range = reloadRangeOf(wallet);
  const [amountText, setAmountText] = useState('');
  const [phase, setPhase] = useState<CardPhase>(() =>
    resumeId ? { kind: 'confirming', reloadId: resumeId } : { kind: 'editing' },
  );
  // Una respuesta perdida se reintenta con la misma llave y el mismo monto: el servidor devuelve la
  // recarga que ya creó en vez de cobrar otra.
  const startKey = useRef<{ key: string; amount: string } | null>(null);
  const amount = parseReloadAmount(amountText);
  const problem = reloadAmountProblem(amountText, range);
  const canPay = amount !== null && problem === null && (phase.kind === 'editing' || phase.kind === 'failed');

  const confirmingId = phase.kind === 'confirming' ? phase.reloadId : null;
  useEffect(() => {
    if (!confirmingId) return;
    let active = true;
    void waitForCardReload(() => api.getCardReload(token, confirmingId), {
      ...(pollMs !== undefined ? { intervalMs: pollMs } : {}),
      isActive: () => active,
    }).then((outcome) => {
      if (!active) return;
      if (outcome.kind === 'credited') setPhase({ kind: 'credited', amount: outcome.reload.monto });
      else if (outcome.kind === 'failed') setPhase({ kind: 'failed', message: 'El banco no aprobó el cobro. No se cargó nada.' });
      else setPhase({ kind: 'in_review', reloadId: confirmingId });
      onSettled?.();
    });
    return () => {
      active = false;
    };
    // onSettled cambia en cada render del padre; el sondeo depende solo de la recarga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmingId, pollMs, token]);

  function edit(text: string) {
    setAmountText(text.replace(/[^\d.,]/g, '').slice(0, 9));
    if (phase.kind === 'failed' || phase.kind === 'review') setPhase({ kind: 'editing' });
  }

  async function start() {
    if (!canPay || !amount) return;
    if (startKey.current?.amount !== amount) startKey.current = { key: createIdempotencyKey(), amount };
    setPhase({ kind: 'starting' });
    try {
      const checkout = await api.startCardReload(token, amount, startKey.current.key);
      startKey.current = null;
      setPhase(reloadExtraCharge(checkout.recarga) ? { kind: 'review', checkout } : { kind: 'paying', checkout });
    } catch (cause) {
      setPhase({ kind: 'failed', message: errorMessage(cause) });
    }
  }

  if (phase.kind === 'credited') {
    return (
      <section className="alumno-card wallet-reload__done" role="status">
        <h2>Listo, entraron {formatAmount(phase.amount)} a tu saldo</h2>
        <Link className="alumno-btn alumno-btn--lime" to="/cuenta/saldo">
          Ir a mi saldo
        </Link>
      </section>
    );
  }

  if (phase.kind === 'confirming') {
    return (
      <section className="alumno-card" role="status">
        <p>Confirmando tu pago con el banco…</p>
      </section>
    );
  }

  if (phase.kind === 'in_review') {
    return (
      <section className="alumno-card" role="status">
        <p>Tu pago sigue en revisión. Si el banco lo aprueba, el saldo llega solo; no pagues otra vez.</p>
        <button
          className="alumno-btn alumno-btn--ghost"
          type="button"
          onClick={() => setPhase({ kind: 'confirming', reloadId: phase.reloadId })}
        >
          Volver a revisar
        </button>
      </section>
    );
  }

  if (phase.kind === 'paying') {
    return (
      <CardReloadStripe
        checkout={phase.checkout}
        onPaid={() => setPhase({ kind: 'confirming', reloadId: phase.checkout.recarga.id })}
        onCancel={() => setPhase({ kind: 'editing' })}
      />
    );
  }

  if (phase.kind === 'review') {
    const extra = reloadExtraCharge(phase.checkout.recarga);
    return (
      <section className="alumno-card wallet-reload__review" aria-labelledby="wallet-reload-review">
        <h2 id="wallet-reload-review">Revisa tu recarga</h2>
        <dl className="wallet-reload__breakdown">
          <div>
            <dt>Entra a tu saldo</dt>
            <dd>${phase.checkout.recarga.monto}</dd>
          </div>
          {extra ? (
            <div>
              <dt>Comisión del pago</dt>
              <dd>${extra}</dd>
            </div>
          ) : null}
          <div>
            <dt>
              <strong>Total a pagar</strong>
            </dt>
            <dd>
              <strong>${centsLabel(phase.checkout.recarga.total_cobrado_cents)}</strong>
            </dd>
          </div>
        </dl>
        <button
          className="alumno-btn alumno-btn--lime"
          type="button"
          onClick={() => setPhase({ kind: 'paying', checkout: phase.checkout })}
        >
          Seguir al pago
        </button>
        <button className="alumno-btn alumno-btn--ghost" type="button" onClick={() => setPhase({ kind: 'editing' })}>
          Cambiar monto
        </button>
      </section>
    );
  }

  const hint = phase.kind === 'failed' ? phase.message : (problem ?? reloadRangeLabel(range));
  return (
    <section className="alumno-card wallet-reload__card" aria-labelledby="wallet-reload-card">
      <h2 id="wallet-reload-card">Recargar con tarjeta</h2>
      <div className="wallet-reload__quick" role="group" aria-label="Montos rápidos">
        {QUICK_RELOAD_AMOUNTS.map((quick) => (
          <button
            key={quick}
            type="button"
            className={`alumno-chip${amount === `${quick}.00` ? ' is-on' : ''}`}
            onClick={() => edit(String(quick))}
          >
            ${quick}
          </button>
        ))}
      </div>
      <label className="wallet-reload__amount">
        <span>Otro monto</span>
        <input
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={amountText}
          onChange={(event) => edit(event.target.value)}
          aria-invalid={problem ? true : undefined}
        />
      </label>
      {hint ? (
        <p className={phase.kind === 'failed' || problem ? 'alumno-error' : 'alumno-muted'} role={phase.kind === 'failed' ? 'alert' : undefined}>
          {hint}
        </p>
      ) : null}
      <button className="alumno-btn alumno-btn--lime" type="button" disabled={!canPay} onClick={() => void start()}>
        {phase.kind === 'starting' ? 'Abriendo el pago…' : amount ? `Recargar ${formatAmount(amount)}` : 'Recargar'}
      </button>
      <p className="alumno-muted">{CARD_RELOAD_NOTE}</p>
    </section>
  );
}

function CardReloadStripe({
  checkout,
  onPaid,
  onCancel,
}: {
  checkout: CardReloadCheckout;
  onPaid: () => void;
  onCancel: () => void;
}) {
  const resolved = useMemo(() => {
    try {
      return { key: resolveTestStripeKey(checkout.pago.publishable_key, stripePublishableKey()), error: null };
    } catch (cause) {
      return { key: null, error: errorMessage(cause) };
    }
  }, [checkout.pago.publishable_key]);
  const stripePromise = useMemo(
    () => (resolved.key ? loadStripe(resolved.key, { stripeAccount: checkout.pago.stripe_account_id }) : null),
    [resolved.key, checkout.pago.stripe_account_id],
  );

  return (
    <section className="alumno-stripe-panel" aria-label="Pago con tarjeta">
      <div className="alumno-stripe-total">
        <div className="alumno-stripe-total__label">
          <span>Total a pagar</span>
          <strong>Recarga de ${checkout.recarga.monto}</strong>
        </div>
        <p className="alumno-wallet-balance">${centsLabel(checkout.recarga.total_cobrado_cents)}</p>
      </div>
      {resolved.error || !stripePromise ? (
        <>
          <p className="alumno-error">{resolved.error ?? 'No se pudo abrir el formulario de pago.'}</p>
          <button className="alumno-btn alumno-btn--ghost" type="button" onClick={onCancel}>
            Volver
          </button>
        </>
      ) : (
        <Elements
          stripe={stripePromise}
          options={{ clientSecret: checkout.pago.client_secret, appearance: { theme: 'stripe' } }}
        >
          <CardReloadForm reloadId={checkout.recarga.id} onPaid={onPaid} onCancel={onCancel} />
        </Elements>
      )}
    </section>
  );
}

function CardReloadForm({ reloadId, onPaid, onCancel }: { reloadId: string; onPaid: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    if (!stripe || !elements || !ready) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await stripe.confirmPayment({
        elements,
        // Si el banco pide 3D Secure y redirige, al volver la página retoma esta recarga.
        confirmParams: {
          return_url: `${window.location.origin}/cuenta/saldo/recargar?recarga=${encodeURIComponent(reloadId)}`,
        },
        redirect: 'if_required',
      });
      if (result.error) {
        // El error crudo de Stripe no se muestra.
        setError('La tarjeta no pasó. Prueba con otra o vuelve a intentar.');
        return;
      }
      onPaid();
    } catch {
      setError('La tarjeta no pasó. Prueba con otra o vuelve a intentar.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="alumno-stripe-form"
      onSubmit={(event) => {
        event.preventDefault();
        void pay();
      }}
    >
      <PaymentElement
        onReady={() => setReady(true)}
        onLoadError={() => {
          setReady(false);
          setError('No se pudo cargar el formulario seguro de pago. Inténtalo de nuevo.');
        }}
      />
      {!ready && !error ? <p role="status">Preparando formulario seguro…</p> : null}
      {error ? <p className="alumno-error">{error}</p> : null}
      <button className="alumno-btn alumno-btn--lime" type="submit" disabled={!stripe || !elements || !ready || submitting}>
        {submitting ? 'Confirmando…' : ready ? 'Pagar ahora' : 'Cargando pago…'}
      </button>
      <button className="alumno-btn alumno-btn--ghost" type="button" onClick={onCancel} disabled={submitting}>
        Salir del pago
      </button>
    </form>
  );
}
