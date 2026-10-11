// Cuándo un enlace guardado de "Tu pedido #N" ya no sirve.
import { VaiinillaApiError } from './api-error';
import type { TrackedOrder } from '../types/api';

/** El seguimiento responde 404/410: el pedido no existe o la sesión de invitado venció. */
export function isGoneTracking(cause: unknown): boolean {
  return cause instanceof VaiinillaApiError && (cause.status === 404 || cause.status === 410);
}

/** Cancelado, no recogido o expirado: nada que seguir. (Entregado ya lo borra su flujo.) */
export function isSettledOrder(order: Pick<TrackedOrder, 'estado'>): boolean {
  return order.estado === 'cancelado' || order.estado === 'no_recogido' || order.estado === 'expirado';
}
