import type { SharedTableOrder } from '../types/api';

/** Resumen compartido de pedidos asignados o pendientes de asignar en una mesa. */
export function assignmentStatus(orders: readonly SharedTableOrder[]): string {
  const assignedToMe = orders.filter((order) => order.lo_pago_yo).length;
  const unassigned = orders.filter(
    (order) => order.pendiente_cobro && !order.pagara && !order.lo_pago_yo,
  ).length;
  return [
    assignedToMe ? `${assignedToMe} marcado${assignedToMe === 1 ? '' : 's'} para pagar` : '',
    unassigned ? `${unassigned} por asignar` : '',
  ].filter(Boolean).join(' · ');
}
