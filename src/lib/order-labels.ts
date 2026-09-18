import type { OrderDetail, OrderStatus } from '../types/api';

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

export function orderPayLabel(order: OrderDetail): string {
  if (order.metodo_pago === 'saldo') return 'Pagado con saldo';
  if (order.metodo_pago === 'stripe') {
    return order.pago?.payment_status === 'confirmado' ? 'Pagado con tarjeta' : 'Tarjeta';
  }
  return 'Efectivo al recoger';
}

export function orderCompactPayLabel(order: OrderDetail): string {
  if (order.metodo_pago === 'saldo') return 'Saldo';
  if (order.metodo_pago === 'stripe') return 'Tarjeta';
  return 'Efectivo';
}

export function orderDestinationLabel(order: OrderDetail): string {
  if (order.destino === 'en_espacio') return order.espacio?.nombre ?? 'En mesa';
  return 'Para llevar';
}

export function orderMetaLine(order: OrderDetail): string {
  return `${orderDestinationLabel(order)} · ${orderCompactPayLabel(order)}`;
}

export function orderItemHeadline(order: OrderDetail): string {
  const first = order.items?.[0];
  if (!first) return `Pedido #${order.folio}`;
  const extra = order.items.length > 1 ? ` +${order.items.length - 1}` : '';
  return `${first.cantidad} ${first.nombre_producto}${extra}`;
}

export function orderHistoryHeadline(order: OrderDetail): string {
  const first = order.items?.[0];
  if (!first) return `Pedido #${order.folio}`;
  return `${first.cantidad}× ${first.nombre_producto}`;
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
  state: 'done' | 'current' | 'todo';
};

export function orderCollapsedStatusHint(status: OrderStatus): string {
  if (status === 'listo') return '';
  return ORDER_STATUS_HINT[status];
}

export function orderTrackSteps(order: OrderDetail): OrderTrackStep[] {
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
