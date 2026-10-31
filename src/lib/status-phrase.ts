import type { OrderDetail } from '../types/api';
import { rentalHoldRemainingMs, rentalStep } from './rental-tracking';

/** Frase breve de seguimiento derivada de los códigos del pedido y la reserva. */
export function statusAsPhrase(order: OrderDetail, now: Date = new Date()): string {
  if (order.reserva) {
    const step = rentalStep(order, now);
    if (step === 'por_pagar') {
      return (rentalHoldRemainingMs(order, now) ?? 1) <= 0
        ? 'El apartado venció'
        : 'Falta pagar tu reserva';
    }
    if (step === 'reservada') return 'Tu cancha está reservada';
    if (step === 'en_juego') return 'Tu horario está en curso';
    if (step === 'terminada') return 'Tu horario terminó';
    if (order.reserva.estado === 'conflicto') return 'Consulta con el personal sobre tu reserva';
    if (order.reserva.estado === 'expirada') return 'La reserva venció';
    return 'La reserva fue cancelada';
  }

  if (order.pago_diferido && order.pago_pendiente) {
    if (order.estado === 'cobrado') return 'Tu pedido está en la cuenta';
    if (order.estado === 'entregado') return 'Tu pedido está por pagar';
  }

  switch (order.estado) {
    case 'por_cobrar': return 'Falta pagar tu pedido';
    case 'cobrado': return 'Recibimos tu pedido';
    case 'preparando': return 'Estamos preparando tu pedido';
    case 'listo': return 'Tu pedido está listo';
    case 'entregado': return 'Tu pedido fue entregado';
    case 'cancelado': return 'Tu pedido fue cancelado';
    case 'no_recogido': return 'Tu pedido no se recogió';
    case 'expirado': return 'El pedido venció';
    default: return 'Revisa el estado de tu pedido';
  }
}
