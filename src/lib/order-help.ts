import type { OrderDetail } from '../types/api';

/** El enlace de WhatsApp del negocio con el mensaje ya escrito. */
export function whatsappWith(url: string, text: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}text=${encodeURIComponent(text)}`;
}

/** Los estados en que un pedido a domicilio aún puede cambiar (Expo `HELP_STATES`). */
const HELP_STATES: readonly string[] = ['por_aceptar', 'cobrado', 'preparando', 'listo', 'en_camino'];

export function canAskForHelp(order: Pick<OrderDetail, 'destino' | 'estado'>): boolean {
  return order.destino === 'a_domicilio' && HELP_STATES.includes(order.estado);
}

/** Los casos de «¿Qué pasó?» y qué pasa con el dinero en cada uno (Doop D7). */
export const ORDER_HELP_CASES: readonly { title: string; detail: string }[] = [
  { title: 'No voy a estar en casa', detail: 'Le avisamos al negocio para cambiar la hora.' },
  { title: 'Cambiar la hora de entrega', detail: 'El negocio confirma la hora nueva antes de salir.' },
  { title: 'Ya pasó la hora y no llega', detail: 'Le preguntamos al negocio por dónde va.' },
  {
    title: 'Llegó dañado o no es lo que pedí',
    detail: 'Mándale una foto por WhatsApp. No pagues el resto hasta que te conteste.',
  },
];