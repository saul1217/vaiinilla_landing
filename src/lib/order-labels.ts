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

export const ORDER_FLOW: OrderStatus[] = ['por_cobrar', 'cobrado', 'preparando', 'listo', 'entregado'];

const TERMINAL: OrderStatus[] = ['entregado', 'cancelado', 'no_recogido', 'expirado'];

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return TERMINAL.includes(status);
}

export function orderPayLabel(order: OrderDetail): string {
  if (order.metodo_pago === 'saldo') return 'Pagado con saldo';
  if (order.metodo_pago === 'stripe') {
    return order.pago?.payment_status === 'confirmado' ? 'Pagado con tarjeta' : 'Tarjeta';
  }
  return 'Efectivo al recoger';
}

export function orderDestinationLabel(order: OrderDetail): string {
  if (order.destino === 'en_espacio') return order.espacio?.nombre ?? 'En mesa';
  return 'Para llevar';
}

export function orderStatusTone(status: OrderStatus): 'ready' | 'warn' | 'danger' | 'muted' | 'default' {
  if (status === 'listo') return 'ready';
  if (status === 'preparando' || status === 'por_cobrar') return 'warn';
  if (status === 'cancelado' || status === 'expirado' || status === 'no_recogido') return 'danger';
  if (status === 'entregado') return 'muted';
  return 'default';
}
