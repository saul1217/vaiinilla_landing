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

const CONFIRMING_PREFIX = 'vaiinilla.buyer.stripe-confirming.v1.';

export function markStripeConfirming(orderId: string): void {
  if (typeof sessionStorage === 'undefined' || !orderId) return;
  sessionStorage.setItem(`${CONFIRMING_PREFIX}${orderId}`, '1');
}

export function isStripeConfirming(orderId: string): boolean {
  if (typeof sessionStorage === 'undefined' || !orderId) return false;
  return sessionStorage.getItem(`${CONFIRMING_PREFIX}${orderId}`) === '1';
}

export function clearStripeConfirming(orderId?: string): void {
  if (typeof sessionStorage === 'undefined') return;
  if (orderId) {
    sessionStorage.removeItem(`${CONFIRMING_PREFIX}${orderId}`);
    return;
  }
  const keys: string[] = [];
  for (let index = 0; index < sessionStorage.length; index += 1) {
    const key = sessionStorage.key(index);
    if (key?.startsWith(CONFIRMING_PREFIX)) keys.push(key);
  }
  keys.forEach((key) => sessionStorage.removeItem(key));
}
