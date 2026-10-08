import type { OperationalOrderStatus, OrderDetail, OrderStatus, PaymentStatus } from '../types/api';
import { moneyToCents } from './money';
import { piecesLabel, splitPieces } from './product-pieces';
import {
  RENTAL_STEPS,
  isLiveRental,
  rentalCourtName,
  rentalScheduleLabel,
  rentalStateLabel,
  rentalStep,
  rentalStepHint,
} from './rental-tracking';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  por_cobrar: 'Por cobrar',
  cobrado: 'Cobrado',
  preparando: 'Preparando',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  no_recogido: 'No recogido',
  expirado: 'Expirado',
};

const OPERATIONAL_LABEL: Record<OperationalOrderStatus, string> = {
  recibido: 'Pedido recibido',
  preparando: 'Preparando',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  no_recogido: 'No recogido',
  expirado: 'Expirado',
};

const LEGACY_OPERATIONAL: Record<OrderStatus, OperationalOrderStatus> = {
  por_cobrar: 'recibido',
  cobrado: 'recibido',
  preparando: 'preparando',
  listo: 'listo',
  entregado: 'entregado',
  cancelado: 'cancelado',
  no_recogido: 'no_recogido',
  expirado: 'expirado',
};

/** Estado de cocina/entrega. El legado `cobrado` ya no representa un pago ni un paso. */
export function orderOperationalStatus(order: Pick<OrderDetail, 'estado'> & Partial<Pick<OrderDetail, 'estado_operativo'>>): OperationalOrderStatus {
  return order.estado_operativo ?? LEGACY_OPERATIONAL[order.estado];
}

export const ORDER_STATUS_HINT: Record<OrderStatus, string> = {
  por_cobrar: 'Caja espera el pago en efectivo.',
  cobrado: 'Cocina recibió la comanda.',
  preparando: 'Tu comida se está preparando.',
  listo: 'Recógelo en la barra.',
  entregado: 'Pedido completado.',
  cancelado: 'Este pedido se canceló.',
  no_recogido: 'No se recogió el pedido.',
  expirado: 'Este pedido expiró.',
};

export function orderOperationalHint(
  order: Pick<OrderDetail, 'motivo_pendiente_operativo' | 'estado'> & Partial<Pick<OrderDetail, 'estado_operativo'>>,
): string | null {
  // Un pedido ya entregado (una renta pagada se da por entregada) o caído no espera a nadie.
  if (isTerminalOrderStatus(orderOperationalStatus(order))) return null;
  if (order.motivo_pendiente_operativo === 'caja_inactiva') {
    return 'Pedido recibido. Caja lo procesará al recuperar la operación.';
  }
  if (order.motivo_pendiente_operativo === 'cocina_inactiva') {
    return 'Pedido recibido. Cocina lo preparará al recuperar la operación.';
  }
  return null;
}

/** El motivo que dio el personal al cancelar, para que el cliente sepa por qué. */
export function orderCancelReason(order: Pick<OrderDetail, 'estado' | 'motivo_cancelacion'>): string | null {
  const motivo = order.motivo_cancelacion?.trim();
  return orderOperationalStatus(order) === 'cancelado' && motivo ? `Motivo: ${motivo}` : null;
}

export const PAYMENT_CONFIRMED_HINT = 'Stripe confirmó el pago; Vaiinilla actualizará el pedido.';

export const ORDER_FLOW: OperationalOrderStatus[] = ['recibido', 'preparando', 'listo', 'entregado'];

const TERMINAL: OrderStatus[] = ['entregado', 'cancelado', 'no_recogido', 'expirado'];
const ACTIVE: OrderStatus[] = ['por_cobrar', 'cobrado', 'preparando', 'listo'];

export function isTerminalOrderStatus(status: OrderStatus | OperationalOrderStatus): boolean {
  return TERMINAL.includes(status as OrderStatus) || ['cancelado', 'no_recogido', 'expirado'].includes(status);
}

export function isActiveOrderStatus(status: OrderStatus | OperationalOrderStatus): boolean {
  return ACTIVE.includes(status as OrderStatus) || ['recibido', 'preparando', 'listo'].includes(status);
}

/** El estado financiero viene del ledger; el booleano legado solo cubre respuestas anteriores. */
export function isOrderPaid(order: Pick<OrderDetail, 'estado_pago' | 'saldo_pendiente' | 'pago_diferido' | 'pago_pendiente'>): boolean {
  if (order.saldo_pendiente !== undefined) {
    const saldo = moneyToCents(order.saldo_pendiente);
    if (saldo !== 0n) return false;
    return order.estado_pago === undefined || order.estado_pago === 'pagado' || order.estado_pago === 'sin_cargo';
  }
  if (order.estado_pago) return order.estado_pago === 'pagado' || order.estado_pago === 'sin_cargo';
  if (order.pago_diferido && order.pago_pendiente !== undefined) return !order.pago_pendiente;
  return false;
}

function orderPaymentStatus(order: Pick<OrderDetail, 'estado_pago' | 'saldo_pendiente' | 'monto_pagado'>): PaymentStatus | undefined {
  if (order.saldo_pendiente === undefined) return order.estado_pago;
  const saldo = moneyToCents(order.saldo_pendiente);
  if (saldo === null || saldo < 0n) {
    return order.estado_pago === 'pagado' || order.estado_pago === 'sin_cargo'
      ? 'pendiente'
      : order.estado_pago;
  }
  if (saldo > 0n) {
    if (order.estado_pago === 'reembolsado') return 'reembolsado';
    const pagado = order.monto_pagado === undefined ? null : moneyToCents(order.monto_pagado);
    return pagado !== null && pagado > 0n ? 'parcial' : 'pendiente';
  }
  if (order.estado_pago) return order.estado_pago;
  const pagado = order.monto_pagado === undefined ? null : moneyToCents(order.monto_pagado);
  return pagado !== null && pagado > 0n ? 'pagado' : undefined;
}

/** Va a la cuenta del espacio y conserva saldo pendiente. */
export function isUnpaidTab(order: Pick<OrderDetail, 'pago_diferido' | 'pago_pendiente' | 'estado_pago' | 'saldo_pendiente' | 'pago'>): boolean {
  return Boolean(order.pago_diferido && !isOrderPaid(order));
}

export function orderPayLabel(order: OrderDetail): string {
  if (order.reserva && order.metodo_pago === 'efectivo') return 'Efectivo en caja';
  const status = orderPaymentStatus(order);
  if (status === 'reembolsado') return 'Reembolsado';
  if (status === 'parcial') return 'Pago parcial';
  if (order.pago_diferido && !isOrderPaid(order)) return 'Pagas al final con tu cuenta';
  if (status === 'sin_cargo') return 'Sin cargo';
  if (isOrderPaid(order)) return 'Pagado';
  return `Pago pendiente · ${paymentMethodLabel(order.metodo_pago)}`;
}

export function orderCompactPayLabel(order: OrderDetail): string {
  const status = orderPaymentStatus(order);
  if (status === 'reembolsado') return 'Reembolsado';
  if (status === 'parcial') return 'Pago parcial';
  if (order.pago_diferido && !isOrderPaid(order)) return 'Pagas al final';
  if (status === 'sin_cargo') return 'Sin cargo';
  if (isOrderPaid(order)) return 'Pagado';
  return `Pago pendiente · ${paymentMethodLabel(order.metodo_pago)}`;
}

function paymentMethodLabel(method: OrderDetail['metodo_pago']): string {
  if (method === 'stripe') return 'tarjeta';
  if (method === 'saldo') return 'saldo';
  return 'efectivo';
}

export function orderDestinationLabel(order: OrderDetail): string {
  if (order.reserva) return rentalCourtName(order) ?? 'Renta de cancha';
  if (order.destino === 'en_espacio') return order.espacio?.nombre ?? 'En mesa';
  return 'Para llevar';
}

export function orderMetaLine(order: OrderDetail, now: Date = new Date()): string {
  if (order.reserva) {
    const court = rentalCourtName(order);
    const schedule = rentalScheduleLabel(order.reserva, now);
    return court ? `${court} · ${schedule}` : schedule;
  }
  return `${orderDestinationLabel(order)} · ${orderCompactPayLabel(order)}`;
}

const HEADLINE_ITEMS = 3;

/** "Tacos dorados de res · 5 pzs": el nombre sin el (N) crudo. */
export function itemNameLabel(rawName: string): string {
  const { name, pieces } = splitPieces(rawName);
  return pieces ? `${name} · ${piecesLabel(pieces)}` : name;
}

export function orderItemHeadline(order: OrderDetail): string {
  // Lo que sí se prepara: un artículo quitado no encabeza la tarjeta.
  const items = (order.items ?? []).filter((item) => !item.rechazo);
  if (items.length === 0) return `Pedido #${order.folio}`;
  const shown = items
    .slice(0, HEADLINE_ITEMS)
    .map((item) => `${item.cantidad} ${itemNameLabel(item.nombre_producto)}`)
    .join(', ');
  const rest = items.length - HEADLINE_ITEMS;
  return rest > 0 ? `${shown} y ${rest} más` : shown;
}

/** "Se quitó Torta: Se terminó el pan." para el cliente, o null si no se quitó nada. */
export function orderRejectedItemsHint(order: OrderDetail): string | null {
  const quitados = (order.items ?? []).filter((item) => item.rechazo);
  if (quitados.length === 0) return null;
  return quitados.map((item) => `Se quitó ${splitPieces(item.nombre_producto).name}: ${item.rechazo?.motivo}.`).join(' ');
}

export function orderHistoryHeadline(order: OrderDetail): string {
  const first = order.items?.[0];
  if (!first) return `Pedido #${order.folio}`;
  return `${first.cantidad}× ${itemNameLabel(first.nombre_producto)}`;
}

/** Texto de la píldora: la renta y la cuenta abierta no se leen como una comida cobrada. */
export function orderStatusLabel(order: OrderDetail, now: Date = new Date()): string {
  if (order.reserva) return rentalStateLabel(order, now);
  return OPERATIONAL_LABEL[orderOperationalStatus(order)];
}

/** "En curso" en Mis pedidos: una renta hasta que termina su horario; una cuenta hasta que se paga. */
export function isActiveOrder(order: OrderDetail, now: Date = new Date()): boolean {
  if (order.reserva) return isLiveRental(order, now);
  if (isUnpaidTab(order) && orderOperationalStatus(order) === 'entregado') return true;
  return isActiveOrderStatus(orderOperationalStatus(order));
}

/** Pedido para llevar que el cliente puede avisar que ya llegó por él. */
export function canAnnounceArrival(order: OrderDetail): boolean {
  return (
    !order.reserva &&
    order.destino === 'para_llevar' &&
    ['recibido', 'preparando', 'listo'].includes(orderOperationalStatus(order))
  );
}

/** Lo que se dice bajo la píldora cuando la tarjeta está cerrada. */
export function orderCollapsedHint(order: OrderDetail, now: Date = new Date()): string {
  if (order.reserva) {
    const step = rentalStep(order, now);
    if (!step) return '';
    return rentalStepHint(step, order.reserva, order.metodo_pago, paymentFailed(order), now);
  }
  const state = orderOperationalStatus(order);
  if (isUnpaidTab(order) && state === 'entregado') return 'Pídele la cuenta a tu mesero para pagar.';
  if (isUnpaidTab(order) && state === 'recibido') return 'Tu pedido se recibió. Pagas al final.';
  return orderCollapsedStatusHint(order.estado);
}

function paymentFailed(order: OrderDetail): boolean {
  const status = order.pago?.payment_status;
  return status === 'fallido' || status === 'cancelado';
}

export function orderStatusTone(status: OrderStatus): 'ready' | 'warn' | 'danger' | 'muted' | 'default' {
  if (status === 'listo') return 'ready';
  if (status === 'preparando' || status === 'por_cobrar') return 'warn';
  if (status === 'cancelado' || status === 'expirado' || status === 'no_recogido') return 'danger';
  if (status === 'entregado') return 'muted';
  return 'default';
}

export function orderFlowIndex(status: OrderStatus): number {
  const operational = LEGACY_OPERATIONAL[status];
  return ORDER_FLOW.indexOf(operational);
}

export function orderProgressFilled(order: OrderDetail): number {
  const idx = ORDER_FLOW.indexOf(orderOperationalStatus(order));
  if (idx < 0) return 0;
  return idx + 1;
}

export type OrderTrackStep = {
  key: string;
  label: string;
  hint: string;
  state: 'done' | 'current' | 'todo' | 'skipped';
};

export function orderCollapsedStatusHint(status: OrderStatus): string {
  if (status === 'por_cobrar' || status === 'cobrado') return 'El establecimiento recibió tu pedido.';
  if (status === 'listo') return '';
  return ORDER_STATUS_HINT[status];
}

/** Sin artículos de cocina, el pedido no se prepara: el backend lo pasa directo a listo. */
export function skipsKitchen(order: OrderDetail): boolean {
  const live = order.items.filter((item) => !item.rechazo);
  return live.length > 0 && live.every((item) => item.estacion_preparacion !== 'cocina');
}

export const PREPARING_SKIPPED_HINT = 'No aplica: este pedido no pasa por cocina.';

/** "Preparando" queda omitido en un pedido sin cocina, para que no parezca casi terminado. */
function markSkippedPreparing(order: OrderDetail, steps: OrderTrackStep[]): OrderTrackStep[] {
  if (!skipsKitchen(order) || orderOperationalStatus(order) === 'preparando') return steps;
  return steps.map((step) =>
    step.key === 'preparando' ? { ...step, state: 'skipped', hint: PREPARING_SKIPPED_HINT } : step,
  );
}

export function orderTrackSteps(order: OrderDetail, now: Date = new Date()): OrderTrackStep[] {
  if (order.reserva) return rentalTrackSteps(order, now);
  if (order.pago_diferido) return markSkippedPreparing(order, tabTrackSteps(order));
  return markSkippedPreparing(order, flowTrackSteps(order));
}

function flowTrackSteps(order: OrderDetail): OrderTrackStep[] {
  const operational = orderOperationalStatus(order);
  const flowIndex = ORDER_FLOW.indexOf(operational);
  const delivered = operational === 'entregado';
  const keys = ['recibido', 'preparando', 'listo', 'entregado'];
  const labels = ['Pedido recibido', 'Preparando', 'Listo', 'Entregado'];
  const hints = [
    order.motivo_pendiente_operativo === 'caja_inactiva'
      ? 'Caja procesará tu pedido al recuperar la operación.'
      : 'Pedido recibido por el establecimiento.',
    ORDER_STATUS_HINT.preparando,
    operational === 'listo' ? '' : ORDER_STATUS_HINT.listo,
    ORDER_STATUS_HINT.entregado,
  ];

  return keys.map((key, index) => {
    let state: OrderTrackStep['state'] = 'todo';
    if (delivered) {
      state = 'done';
    } else if (flowIndex >= 0 && index < flowIndex) {
      state = 'done';
    } else if (flowIndex >= 0 && index === flowIndex) {
      state = 'current';
    }
    return { key, label: labels[index] ?? key, hint: hints[index] ?? '', state };
  });
}

function rentalTrackSteps(order: OrderDetail, now: Date): OrderTrackStep[] {
  const reserva = order.reserva;
  const current = rentalStep(order, now);
  if (!reserva || !current) return [];
  const index = RENTAL_STEPS.findIndex((item) => item.key === current);
  return RENTAL_STEPS.map((item, i) => ({
    key: item.key,
    label: item.label,
    hint:
      i === index
        ? rentalStepHint(item.key, reserva, order.metodo_pago, paymentFailed(order), now)
        : '',
    state: current === 'terminada' || i < index ? 'done' : i === index ? 'current' : 'todo',
  }));
}

/** Pedido a la cuenta: nace cobrado para que Cocina lo prepare, y se paga al final. */
function tabTrackSteps(order: OrderDetail): OrderTrackStep[] {
  const operational = orderOperationalStatus(order);
  const flowIndex = ORDER_FLOW.indexOf(operational);
  const delivered = operational === 'entregado';
  const rows: Omit<OrderTrackStep, 'state'>[] = [
    { key: 'recibido', label: 'Pedido recibido', hint: 'El pedido se agrega a la cuenta de mesa.' },
    { key: 'preparando', label: 'Preparando', hint: ORDER_STATUS_HINT.preparando },
    { key: 'listo', label: 'Listo', hint: operational === 'listo' ? '' : 'Tu mesero te lo lleva.' },
    { key: 'entregado', label: 'Entregado', hint: ORDER_STATUS_HINT.entregado },
  ];
  return rows.map((row, index) => {
    let state: OrderTrackStep['state'] = 'todo';
    if (delivered) state = 'done';
    else if (flowIndex >= 0 && index < flowIndex) state = 'done';
    else if (flowIndex >= 0 && index === flowIndex) state = 'current';
    return { ...row, state };
  });
}

/** Lo que el cliente debe en su cuenta abierta (pedidos a la cuenta aún sin cobrar). */
export function openTab(orders: OrderDetail[]): { count: number; total: string | null } | null {
  const pending = orders.filter((order) => isUnpaidTab(order) && orderOperationalStatus(order) !== 'cancelado');
  if (pending.length === 0) return null;
  const balances = pending.map((order) => moneyToCents(order.saldo_pendiente ?? ''));
  const validBalances = balances.filter((balance): balance is bigint => balance !== null && balance > 0n);
  if (validBalances.length !== pending.length) {
    return { count: pending.length, total: null };
  }
  const cents = validBalances.reduce((sum, balance) => sum + balance, 0n);
  const whole = cents / 100n;
  const rest = (cents % 100n).toString().padStart(2, '0');
  return { count: pending.length, total: `${whole}.${rest}` };
}
