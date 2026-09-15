import { useMemo, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { api } from '../lib/api';
import { errorMessage } from '../lib/api-error';
import { formatMoney } from '../lib/money';
import { resolveStripePublishableKey, stripePublishableKey } from '../lib/stripe-public';
import { STRIPE_TOTAL_LABEL } from '../lib/stripe-status';
import type { OrderDetail, StripePaymentSession } from '../types/api';

interface StripePaymentPanelProps {
  order: OrderDetail;
  session: StripePaymentSession;
  hostname?: string;
  onConfirmed: () => void;
  onCanceled: () => void;
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
  hostname = typeof window === 'undefined' ? '' : window.location.hostname,
  onConfirmed,
  onCanceled,
}: StripePaymentPanelProps) {
  const resolved = useMemo(() => {
    try {
      return {
        key: resolveStripePublishableKey({
          received: session.publishable_key,
          envKey: stripePublishableKey(),
          hostname,
          apiUrl: api.apiUrl,
        }),
        error: null as string | null,
      };
    } catch (cause) {
      return { key: null as string | null, error: errorMessage(cause) };
    }
  }, [hostname, session.publishable_key]);

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
          <StripeCheckoutForm orderId={order.id} onConfirmed={onConfirmed} onCanceled={onCanceled} />
        </Elements>
      )}
    </section>
  );
}

function StripeCheckoutForm({
  orderId,
  onConfirmed,
  onCanceled,
}: {
  orderId: string;
  onConfirmed: () => void;
  onCanceled: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
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
        return;
      }
      onConfirmed();
    } catch (cause) {
      setError(errorMessage(cause));
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
      <PaymentElement />
      {error ? <p className="alumno-error">{error}</p> : null}
      <button className="alumno-btn alumno-btn--lime" type="submit" disabled={!stripe || submitting}>
        {submitting ? 'Confirmando…' : 'Pagar ahora'}
      </button>
      <button className="alumno-btn alumno-btn--ghost" type="button" onClick={onCanceled} disabled={submitting}>
        Salir del pago
      </button>
    </form>
  );
}
