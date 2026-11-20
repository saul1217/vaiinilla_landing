import { isStripePaymentConfirmedByBackend } from './stripe-status';
import type { DeliveryValidation, OrderDetail } from '../types/api';

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

const PICKUP_SURFACE_STATES: OrderDetail['estado'][] = ['listo'];
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
  rememberPickupCode(order.id, order.codigo_recoger);
  return resolvePickupQrToken(order);
}

const CODE_PREFIX = 'vaiinilla.buyer.pickup-code.v1.';
const PICKUP_CODE = /^\d{4}$/;

/**
 * Los 4 dígitos que el cliente dicta en la barra si no le escanean el QR. Llegan con el QR al crear
 * el pedido o al recuperarlo; se guardan igual que el QR para verlos en otra visita.
 */
export function rememberPickupCode(orderId: string, code: string | null | undefined): void {
  if (typeof window === 'undefined' || !code || !PICKUP_CODE.test(code.trim())) return;
  window.localStorage.setItem(`${CODE_PREFIX}${orderId}`, code.trim());
}

export function resolvePickupCode(order: OrderDetail): string | null {
  const fromOrder = order.codigo_recoger?.trim();
  if (fromOrder && PICKUP_CODE.test(fromOrder)) return fromOrder;
  if (typeof window === 'undefined') return null;
  const saved = window.localStorage.getItem(`${CODE_PREFIX}${order.id}`)?.trim();
  return saved && PICKUP_CODE.test(saved) ? saved : null;
}

export function shouldShowPickupSurface(order: OrderDetail): boolean {
  if (!PICKUP_SURFACE_STATES.includes(order.estado)) return false;
  if (order.metodo_pago === 'stripe' && !isStripePaymentConfirmedByBackend(order)) return false;
  return true;
}

export function shouldShowPickupQr(order: OrderDetail, token: string | null | undefined): boolean {
  if (!token?.trim()) return false;
  if (!shouldShowPickupSurface(order)) return false;
  if (order.metodo_pago === 'stripe') return isStripePaymentConfirmedByBackend(order);
  return true;
}

/**
 * Un pedido en efectivo que todavía se paga en caja: por cobrar, o preparándose o listo sin pagar
 * (con «Cocina prepara antes de cobrar» avanza antes del cobro). Con el cobro con código (225) el
 * cliente enseña su código ahí. Sin `saldo_pendiente` (back anterior), solo por cobrar.
 */
export function owesAtCounter(order: OrderDetail): boolean {
  if (order.metodo_pago !== 'efectivo' || order.pago_diferido === true) return false;
  if (order.estado === 'por_cobrar') return true;
  if (order.estado !== 'preparando' && order.estado !== 'listo') return false;
  const due = Number(order.saldo_pendiente ?? '0');
  return Number.isFinite(due) && due > 0;
}

export function shouldRecoverPickupQr(order: OrderDetail): boolean {
  // Por pagar en caja: el back da el código solo si el negocio pide código para cobrar.
  if (owesAtCounter(order)) return true;
  if (!RECOVER_STATES.includes(order.estado)) return false;
  if (order.metodo_pago === 'stripe' && !isStripePaymentConfirmedByBackend(order)) return false;
  return true;
}

export function isShortPickupCode(token: string): boolean {
  return /^[A-Za-z0-9_-]{3,12}$/.test(token);
}

/** Lo que decide qué prueba enseña el cliente: cómo valida la entrega el negocio y si pide código al cobrar. */
export interface PickupRules {
  mode?: DeliveryValidation;
  cobroCodigo?: boolean;
}

/**
 * Qué se enseña en el panel (migraciones 225 y 227 del back):
 * - listo: la prueba que acepta la entrega; con «sin validar», ninguna.
 * - por cobrar en caja con el cobro con código: el cobro trata «sin validar» como QR o código.
 * - «solo código»: el QR va plegado, para cuando el código se bloquee tras 5 intentos.
 * Sin modo (back anterior), QR y código, como siempre.
 */
export function pickupProofs(
  order: OrderDetail,
  rules: PickupRules = {},
): { surface: boolean; code: boolean; qr: 'show' | 'folded' | 'hidden' } {
  const atCounter = owesAtCounter(order) && rules.cobroCodigo === true;
  const surface = shouldShowPickupSurface(order) || atCounter;
  if (!surface) return { surface: false, code: false, qr: 'hidden' };
  const mode = rules.mode === 'ninguna' && atCounter ? 'qr_o_codigo' : rules.mode;
  switch (mode) {
    case 'qr':
      return { surface, code: false, qr: 'show' };
    case 'codigo':
      return { surface, code: true, qr: 'folded' };
    case 'ninguna':
      return { surface, code: false, qr: 'hidden' };
    default:
      return { surface, code: true, qr: 'show' };
  }
}

/**
 * «Mi código»: los pedidos del día en el orden en que el cliente los necesita a la mano. Primero lo
 * listo, después lo que se paga en caja, lo que se prepara y al final lo entregado.
 */
const MY_CODE_RANK: Partial<Record<OrderDetail['estado'], number>> = {
  listo: 0,
  por_cobrar: 1,
  por_aceptar: 2,
  cobrado: 3,
  preparando: 3,
  entregado: 4,
};

export function myCodeOrders(orders: OrderDetail[], today: string): OrderDetail[] {
  return orders
    .filter((order) => order.estado in MY_CODE_RANK && (order.fecha_operativa ?? today) === today)
    .sort((a, b) => (MY_CODE_RANK[a.estado] ?? 9) - (MY_CODE_RANK[b.estado] ?? 9) || b.folio - a.folio);
}
