import { useMemo, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
// `pure` no inserta Stripe.js al importar: su antifraude corría en cada toque de toda la
// app. Así se carga solo cuando este panel va a cobrar.
import { loadStripe } from '@stripe/stripe-js/pure';
import { api } from '../lib/api';
import { errorMessage } from '../lib/api-error';
import type { AppEnvironment } from '../lib/env';
import { formatMoney } from '../lib/money';
import { resolveStripePublishableKey, stripePublishableKey } from '../lib/stripe-public';
import { STRIPE_TOTAL_LABEL } from '../lib/stripe-status';
import type { OrderDetail, StripePaymentSession } from '../types/api';

interface StripePaymentPanelProps {
  order: OrderDetail;
  session: StripePaymentSession;
  /** Defaults to VITE_APP_ENV; tests pass it explicitly. */
  environment?: AppEnvironment;
  onConfirmed: () => void;
  onCanceled: () => void;
  onProcessing?: () => void;
  onProcessingFailed?: () => void;
}

export function StripeOrderTotal({ order }: { order: OrderDetail }) {
  return (
    <div className="alumno-stripe-total">
      <div className="alumno-stripe-total__label">
        <span>{STRIPE_TOTAL_LABEL}</span>
        <strong>Pedido #{order.folio}</strong>
      </div>
      <p className="alumno-wallet-balance">{formatMoney(order.total)}</p>
    </div>
  );
}

export function StripePaymentPanel({
  order,
  session,
  environment,
  onConfirmed,
  onCanceled,
  onProcessing,
  onProcessingFailed,
}: StripePaymentPanelProps) {
  const resolved = useMemo(() => {
    try {
      return {
        key: resolveStripePublishableKey({
          received: session.publishable_key,
          envKey: stripePublishableKey(),
          environment,
          apiUrl: api.apiUrl,
        }),
        error: null as string | null,
      };
    } catch (cause) {
      return { key: null as string | null, error: errorMessage(cause) };
    }
  }, [environment, session.publishable_key]);

  const stripePromise = useMemo(() => {
    if (!resolved.key) return null;
    return loadStripe(resolved.key, { stripeAccount: session.stripe_account_id });
  }, [resolved.key, session.stripe_account_id]);

  return (
    <section className="alumno-stripe-panel" aria-label="Pago con tarjeta">
      <StripeOrderTotal order={order} />
      {resolved.error || !stripePromise ? (
        <p className="alumno-error">{resolved.error ?? 'No se pudo abrir Stripe.'}</p>
      ) : (
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret: session.client_secret,
            appearance: { theme: 'stripe' },
          }}
        >
          <StripeCheckoutForm
            orderId={order.id}
            onConfirmed={onConfirmed}
            onCanceled={onCanceled}
            onProcessing={onProcessing}
            onProcessingFailed={onProcessingFailed}
          />
        </Elements>
      )}
    </section>
  );
}

function StripeCheckoutForm({
  orderId,
  onConfirmed,
  onCanceled,
  onProcessing,
  onProcessingFailed,
}: {
  orderId: string;
  onConfirmed: () => void;
  onCanceled: () => void;
  onProcessing?: () => void;
  onProcessingFailed?: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [elementReady, setElementReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    if (!stripe || !elements || !elementReady) return;
    if (!elements.getElement(PaymentElement)) {
      setError('El formulario de pago todavía no está listo. Espera un momento.');
      setElementReady(false);
      return;
    }
    setSubmitting(true);
    setError(null);
    onProcessing?.();
    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/cuenta/pedidos/${orderId}`,
        },
        redirect: 'if_required',
      });
      if (result.error) {
        setError(result.error.message ?? 'No se pudo confirmar el pago.');
        onProcessingFailed?.();
        return;
      }
      onConfirmed();
    } catch (cause) {
      setError(errorMessage(cause));
      onProcessingFailed?.();
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
        onReady={() => setElementReady(true)}
        onLoadError={() => {
          setElementReady(false);
          setError('No se pudo cargar el formulario seguro de pago. Inténtalo de nuevo.');
        }}
      />
      {!elementReady && !error ? <p role="status">Preparando formulario seguro…</p> : null}
      {error ? <p className="alumno-error">{error}</p> : null}
      <button
        className="alumno-btn alumno-btn--lime"
        type="submit"
        disabled={!stripe || !elements || !elementReady || submitting}
      >
        {submitting ? 'Confirmando…' : elementReady ? 'Pagar ahora' : 'Cargando pago…'}
      </button>
      <button className="alumno-btn alumno-btn--ghost" type="button" onClick={onCanceled} disabled={submitting}>
        Salir del pago
      </button>
    </form>
  );
}
