import type { OrderDetail, OrderStatus } from '../types/api';
import { moneyToCents } from './money';
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
  order: Pick<OrderDetail, 'motivo_pendiente_operativo'> & Partial<Pick<OrderDetail, 'estado'>>,
): string | null {
  // Un pedido ya entregado (una renta pagada se da por entregada) o caído no espera a nadie.
  if (order.estado && TERMINAL.includes(order.estado)) return null;
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
  return order.estado === 'cancelado' && motivo ? `Motivo: ${motivo}` : null;
}

export const PAYMENT_CONFIRMED_HINT = 'Stripe confirmó el pago; Vaiinilla actualizará el pedido.';

export const ORDER_FLOW: OrderStatus[] = ['por_cobrar', 'cobrado', 'preparando', 'listo', 'entregado'];

const TERMINAL: OrderStatus[] = ['entregado', 'cancelado', 'no_recogido', 'expirado'];
const ACTIVE: OrderStatus[] = ['por_cobrar', 'cobrado', 'preparando', 'listo'];

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return TERMINAL.includes(status);
}

export function isActiveOrderStatus(status: OrderStatus): boolean {
  return ACTIVE.includes(status);
}

/** Va a la cuenta del espacio y aún no se cobra (pagar al final). */
export function isUnpaidTab(order: Pick<OrderDetail, 'pago_diferido' | 'pago_pendiente'>): boolean {
  return Boolean(order.pago_diferido && order.pago_pendiente);
}

export function orderPayLabel(order: OrderDetail): string {
  if (order.reserva && order.metodo_pago === 'efectivo') return 'Efectivo en caja';
  if (isUnpaidTab(order)) return 'Se paga al final';
  if (order.pago_diferido) return 'Cuenta pagada';
  if (order.metodo_pago === 'saldo') return 'Pagado con saldo';
  if (order.metodo_pago === 'stripe') {
    return order.pago?.payment_status === 'confirmado' ? 'Pagado con tarjeta' : 'Tarjeta';
  }
  return 'Efectivo al recoger';
}

export function orderCompactPayLabel(order: OrderDetail): string {
  if (isUnpaidTab(order)) return 'Al final';
  if (order.metodo_pago === 'saldo') return 'Saldo';
  if (order.metodo_pago === 'stripe') return 'Tarjeta';
  return 'Efectivo';
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

export function orderItemHeadline(order: OrderDetail): string {
  // Lo que sí se prepara: un artículo quitado no encabeza la tarjeta.
  const items = (order.items ?? []).filter((item) => !item.rechazo);
  const first = items[0];
  if (!first) return `Pedido #${order.folio}`;
  const extra = items.length > 1 ? ` +${items.length - 1}` : '';
  return `${first.cantidad} ${first.nombre_producto}${extra}`;
}

/** "Se quitó Torta: Se terminó el pan." para el cliente, o null si no se quitó nada. */
export function orderRejectedItemsHint(order: OrderDetail): string | null {
  const quitados = (order.items ?? []).filter((item) => item.rechazo);
  if (quitados.length === 0) return null;
  return quitados.map((item) => `Se quitó ${item.nombre_producto}: ${item.rechazo?.motivo}.`).join(' ');
}

export function orderHistoryHeadline(order: OrderDetail): string {
  const first = order.items?.[0];
  if (!first) return `Pedido #${order.folio}`;
  return `${first.cantidad}× ${first.nombre_producto}`;
}

/** Texto de la píldora: la renta y la cuenta abierta no se leen como una comida cobrada. */
export function orderStatusLabel(order: OrderDetail, now: Date = new Date()): string {
  if (order.reserva) return rentalStateLabel(order, now);
  if (isUnpaidTab(order)) {
    if (order.estado === 'cobrado') return 'En tu cuenta';
    if (order.estado === 'entregado') return 'Por pagar';
  }
  return ORDER_STATUS_LABEL[order.estado];
}

/** "En curso" en Mis pedidos: una renta hasta que termina su horario; una cuenta hasta que se paga. */
export function isActiveOrder(order: OrderDetail, now: Date = new Date()): boolean {
  if (order.reserva) return isLiveRental(order, now);
  if (isUnpaidTab(order) && order.estado === 'entregado') return true;
  return isActiveOrderStatus(order.estado);
}

/** Pedido para llevar que el cliente puede avisar que ya llegó por él. */
export function canAnnounceArrival(order: OrderDetail): boolean {
  return (
    !order.reserva &&
    order.destino === 'para_llevar' &&
    ['por_cobrar', 'cobrado', 'preparando', 'listo'].includes(order.estado)
  );
}

/** Lo que se dice bajo la píldora cuando la tarjeta está cerrada. */
export function orderCollapsedHint(order: OrderDetail, now: Date = new Date()): string {
  if (order.reserva) {
    const step = rentalStep(order, now);
    if (!step) return '';
    return rentalStepHint(step, order.reserva, order.metodo_pago, paymentFailed(order), now);
  }
  if (isUnpaidTab(order) && order.estado === 'cobrado') return 'Cocina recibió tu pedido. Pagas al final.';
  if (isUnpaidTab(order) && order.estado === 'entregado') return 'Pídele la cuenta a tu mesero para pagar.';
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
  return ORDER_FLOW.indexOf(status);
}

export function orderProgressFilled(order: OrderDetail): number {
  const idx = orderFlowIndex(order.estado);
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
  if (!skipsKitchen(order) || order.estado === 'preparando') return steps;
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
  const stripe = order.metodo_pago === 'stripe';
  const flowIndex = orderFlowIndex(order.estado);
  const delivered = order.estado === 'entregado';
  const keys = stripe
    ? ['pago_confirmado', 'cobrado', 'preparando', 'listo', 'entregado']
    : ['por_cobrar', 'cobrado', 'preparando', 'listo', 'entregado'];
  const labels = stripe
    ? ['Pago confirmado', 'Cobrado', 'Preparando', 'Listo', 'Entregado']
    : ['Por cobrar', 'Cobrado', 'Preparando', 'Listo', 'Entregado'];
  const listoHint = order.estado === 'listo' ? '' : ORDER_STATUS_HINT.listo;
  const hints = stripe
    ? [
        PAYMENT_CONFIRMED_HINT,
        ORDER_STATUS_HINT.cobrado,
        ORDER_STATUS_HINT.preparando,
        listoHint,
        ORDER_STATUS_HINT.entregado,
      ]
    : [
        ORDER_STATUS_HINT.por_cobrar,
        ORDER_STATUS_HINT.cobrado,
        ORDER_STATUS_HINT.preparando,
        listoHint,
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
  const flowIndex = orderFlowIndex(order.estado);
  const delivered = order.estado === 'entregado';
  const paid = !order.pago_pendiente;
  const rows: Omit<OrderTrackStep, 'state'>[] = [
    { key: 'enviado', label: 'Pedido enviado', hint: 'Pagas al final, con toda tu cuenta.' },
    {
      key: 'cobrado',
      label: paid ? 'Cobrado' : 'En tu cuenta',
      hint: paid ? 'Tu cuenta ya se pagó.' : ORDER_STATUS_HINT.cobrado,
    },
    { key: 'preparando', label: 'Preparando', hint: ORDER_STATUS_HINT.preparando },
    { key: 'listo', label: 'Listo', hint: order.estado === 'listo' ? '' : 'Tu mesero te lo lleva.' },
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
export function openTab(orders: OrderDetail[]): { count: number; total: string } | null {
  const pending = orders.filter((order) => isUnpaidTab(order) && order.estado !== 'cancelado');
  if (pending.length === 0) return null;
  const cents = pending.reduce((sum, order) => sum + (moneyToCents(order.total) ?? 0n), 0n);
  const whole = cents / 100n;
  const rest = (cents % 100n).toString().padStart(2, '0');
  return { count: pending.length, total: `${whole}.${rest}` };
}
