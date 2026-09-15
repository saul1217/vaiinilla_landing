export function stripePublishableKey(): string | undefined {
  const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim();
  return key ? key : undefined;
}

export function isStripeCheckoutEnabled(): boolean {
  return Boolean(stripePublishableKey());
}

export const STRIPE_UNAVAILABLE_COPY = 'Pago con tarjeta no disponible por ahora.';
