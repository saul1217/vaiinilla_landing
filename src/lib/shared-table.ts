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

/** Key estable de un grupo: el participante, nunca el alias (hay tocayos). */
export function tableGroupKey(group: SharedTable['grupos'][number], index: number): string {
  return group.participante_id ?? `sin-participante-${index}`;
}

/** Key estable de una persona en la mesa: su id, nunca el alias. */
export function tablePersonKey(
  person: SharedTable['participantes'][number],
  index: number,
): string {
  const id = (person as { id?: unknown }).id;
  return typeof id === 'string' && id ? id : `sin-id-${index}`;
}

/**
 * Cuántos hay en la mesa. "Solo tú" solo si nadie más tiene pedidos: los de quien
 * no se unió también son de otros.
 */
export function tableHeadcountLabel(table: SharedTable): string {
  const people = table.participantes.length;
  if (people > 1) return `${people} personas`;
  const othersOrdering = table.grupos.some((group) => !group.soy_yo && group.pedidos.length > 0);
  return othersOrdering ? 'Tú y pedidos de otros' : 'Solo tú';
}

/** Tu alias en la mesa: el del participante cuando existe. */
export function myTableAlias(table: SharedTable): string {
  return table.mi_participante?.alias ?? table.mi_alias;
}
