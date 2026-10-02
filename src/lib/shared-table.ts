import { ORDER_STATUS_LABEL } from './order-labels';
import type { SharedTable } from '../types/api';

/**
 * El estado de un pedido de la mesa. A la cuenta, `cobrado` solo quiere decir que
 * Cocina lo recibió: mientras no se pague, se dice que está en la cuenta.
 */
export function tableOrderState(order: SharedTable['grupos'][number]['pedidos'][number]): string {
  if (order.pendiente_cobro) return order.estado === 'cobrado' ? 'En la cuenta' : ORDER_STATUS_LABEL[order.estado];
  return `${ORDER_STATUS_LABEL[order.estado]} · pagado`;
}

/** Tus pedidos primero; luego el resto en el orden en que se unieron. */
export function orderedGroups(table: SharedTable): SharedTable['grupos'] {
  return [...table.grupos].sort((a, b) => Number(b.soy_yo) - Number(a.soy_yo));
}
