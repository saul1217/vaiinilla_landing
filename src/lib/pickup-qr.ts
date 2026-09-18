import { isStripePaymentConfirmedByBackend } from './stripe-status';
import type { OrderDetail } from '../types/api';

const STORAGE_PREFIX = 'vaiinilla.buyer.pickup-qr.v1.';

/** Fields the API may send as the staff-scan payload. Never treat folio as a QR secret. */
const QR_FIELD_KEYS = [
  'qr_token',
  'qrToken',
  'token_entrega',
  'token_qr',
  'codigo_qr',
  'codigo_retiro',
  'pickup_token',
  'pickup_code',
] as const;

const PICKUP_SURFACE_STATES: OrderDetail['estado'][] = ['cobrado', 'preparando', 'listo'];
const RECOVER_STATES: OrderDetail['estado'][] = ['cobrado', 'preparando', 'listo', 'entregado'];

function storageKey(orderId: string): string {
  return `${STORAGE_PREFIX}${orderId}`;
}

function writeStore(store: Storage | undefined, orderId: string, token: string): void {
  if (!store) return;
  store.setItem(storageKey(orderId), token);
}

function readStore(store: Storage | undefined, orderId: string): string | null {
  if (!store) return null;
  return store.getItem(storageKey(orderId))?.trim() || null;
}

/** Persist the pickup token across visits. sessionStorage is wiped when the buyer leaves. */
export function rememberPickupQrToken(orderId: string, token: string | null | undefined): void {
  if (typeof window === 'undefined' || !token?.trim()) return;
  const value = token.trim();
  writeStore(window.localStorage, orderId, value);
  writeStore(window.sessionStorage, orderId, value);
}

export function readPickupQrToken(orderId: string): string | null {
  if (typeof window === 'undefined') return null;
  const local = readStore(window.localStorage, orderId);
  if (local) return local;
  const session = readStore(window.sessionStorage, orderId);
  if (session) {
    writeStore(window.localStorage, orderId, session);
    return session;
  }
  return null;
}

function asToken(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function pickupQrPayloadFromOrder(order: OrderDetail): string | null {
  const record = order as OrderDetail & Record<string, unknown>;
  for (const key of QR_FIELD_KEYS) {
    const value = asToken(record[key]);
    if (value) return value;
  }
  const codigo = asToken(record.codigo);
  if (codigo && codigo !== String(order.folio) && codigo !== `#${order.folio}`) {
    return codigo;
  }
  return null;
}

export function resolvePickupQrToken(order: OrderDetail): string | null {
  return pickupQrPayloadFromOrder(order) ?? readPickupQrToken(order.id);
}

export function persistPickupQrFromOrder(order: OrderDetail): string | null {
  const fromOrder = pickupQrPayloadFromOrder(order);
  if (fromOrder) rememberPickupQrToken(order.id, fromOrder);
  return resolvePickupQrToken(order);
}

export function shouldShowPickupSurface(order: OrderDetail): boolean {
  if (!PICKUP_SURFACE_STATES.includes(order.estado)) return false;
  if (order.metodo_pago === 'stripe' && !isStripePaymentConfirmedByBackend(order)) return false;
  return true;
}

export function shouldShowPickupQr(order: OrderDetail, token: string | null | undefined): boolean {
  if (!token?.trim()) return false;
  if (order.estado === 'cancelado' || order.estado === 'expirado' || order.estado === 'no_recogido') {
    return false;
  }
  if (order.metodo_pago === 'stripe') return isStripePaymentConfirmedByBackend(order);
  return true;
}

export function shouldRecoverPickupQr(order: OrderDetail): boolean {
  if (!RECOVER_STATES.includes(order.estado)) return false;
  if (order.metodo_pago === 'stripe' && !isStripePaymentConfirmedByBackend(order)) return false;
  return true;
}

export function isShortPickupCode(token: string): boolean {
  return /^[A-Za-z0-9_-]{3,12}$/.test(token);
}
