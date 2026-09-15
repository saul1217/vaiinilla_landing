const STORAGE_KEY = 'vaiinilla.buyer.stripe-pending-order.v1';

export function stripeRetryFingerprint(orderId: string): string {
  return `stripe-retry:${orderId}`;
}

export function readPendingStripeOrderId(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  const value = sessionStorage.getItem(STORAGE_KEY);
  return value && value.trim() ? value.trim() : null;
}

export function savePendingStripeOrderId(orderId: string): void {
  sessionStorage.setItem(STORAGE_KEY, orderId);
}

export function clearPendingStripeOrderId(orderId?: string): void {
  if (typeof sessionStorage === 'undefined') return;
  if (orderId && sessionStorage.getItem(STORAGE_KEY) !== orderId) return;
  sessionStorage.removeItem(STORAGE_KEY);
}
