const STORAGE_PREFIX = 'vaiinilla.buyer.pickup-qr.v1.';

function storageKey(orderId: string): string {
  return `${STORAGE_PREFIX}${orderId}`;
}

/** The API exposes the pickup token only when an order is created. */
export function rememberPickupQrToken(orderId: string, token: string | null | undefined): void {
  if (typeof sessionStorage === 'undefined' || !token?.trim()) return;
  sessionStorage.setItem(storageKey(orderId), token.trim());
}

export function readPickupQrToken(orderId: string): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  const token = sessionStorage.getItem(storageKey(orderId));
  return token?.trim() || null;
}
