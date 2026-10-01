// Seguimiento de una renta de cancha. No pasa por cocina: se paga, queda reservada, se juega y
// termina. El backend da el pedido de renta por entregado al cobrarse (docs/reservas-cancha.md),
// así que el paso sale de la reserva y de la hora, no del estado del pedido. Espejo de
// RentalTracking.kt (Android).
import type { OrderDetail, OrderReservation, PaymentMethod } from '../types/api';

export type RentalStep = 'por_pagar' | 'reservada' | 'en_juego' | 'terminada';

export const RENTAL_STEPS: { key: RentalStep; label: string }[] = [
  { key: 'por_pagar', label: 'Por pagar' },
  { key: 'reservada', label: 'Reservada' },
  { key: 'en_juego', label: 'En juego' },
  { key: 'terminada', label: 'Terminada' },
];

const DEAD_ORDER: OrderDetail['estado'][] = ['cancelado', 'no_recogido', 'expirado'];

export function isRental(order: Pick<OrderDetail, 'reserva'>): boolean {
  return Boolean(order.reserva);
}

/** Paso actual; `null` si no es renta o si se cayó (cancelada, vencida o en revisión). */
export function rentalStep(
  order: Pick<OrderDetail, 'reserva' | 'estado'>,
  now: Date = new Date(),
): RentalStep | null {
  const reserva = order.reserva;
  if (!reserva || DEAD_ORDER.includes(order.estado)) return null;
  switch (reserva.estado) {
    case 'pendiente_pago':
      return 'por_pagar';
    case 'confirmada':
    case 'en_curso':
    case 'terminada': {
      const t = now.getTime();
      if (t >= Date.parse(reserva.fin)) return 'terminada';
      if (t >= Date.parse(reserva.inicio)) return 'en_juego';
      return 'reservada';
    }
    default:
      return null;
  }
}

/** Una renta sigue "en curso" en Mis pedidos hasta que termina su horario o se cae. */
export function isLiveRental(
  order: Pick<OrderDetail, 'reserva' | 'estado'>,
  now: Date = new Date(),
): boolean {
  const step = rentalStep(order, now);
  return step !== null && step !== 'terminada';
}

const FALLEN_LABEL: Partial<Record<OrderReservation['estado'], string>> = {
  cancelada: 'Cancelada',
  expirada: 'Venció el apartado',
  conflicto: 'Revisar con el personal',
};

export function rentalStateLabel(
  order: Pick<OrderDetail, 'reserva' | 'estado'>,
  now: Date = new Date(),
): string {
  const step = rentalStep(order, now);
  if (step) return RENTAL_STEPS.find((item) => item.key === step)?.label ?? '';
  return (order.reserva && FALLEN_LABEL[order.reserva.estado]) ?? 'Cancelada';
}

const HOUR = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
const DAY = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "hoy", "mañana" o "vie 3 oct". */
export function rentalDay(start: Date, now: Date = new Date()): string {
  if (sameDay(start, now)) return 'hoy';
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (sameDay(start, tomorrow)) return 'mañana';
  return DAY.format(start).replace(/\./g, '').replace(' de ', ' ');
}

/** "Hoy · 18:00–19:00", "Mañana · …" o "Vie 3 oct · …". */
export function rentalScheduleLabel(reserva: OrderReservation, now: Date = new Date()): string {
  const start = new Date(reserva.inicio);
  const day = rentalDay(start, now);
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${HOUR.format(start)}–${HOUR.format(new Date(reserva.fin))}`;
}

export function rentalStepHint(
  step: RentalStep,
  reserva: OrderReservation,
  method: PaymentMethod,
  paymentFailed = false,
  now: Date = new Date(),
): string {
  switch (step) {
    case 'por_pagar':
      if (method === 'efectivo') return 'Paga en caja para confirmar tu horario.';
      if (method === 'stripe') {
        return paymentFailed
          ? 'El pago no se completó. Reintenta para no perder el horario.'
          : 'Termina el pago con tarjeta para confirmar tu horario.';
      }
      return 'Estamos confirmando tu pago.';
    case 'reservada': {
      const start = new Date(reserva.inicio);
      const day = rentalDay(start, now);
      const onDay = day === 'hoy' || day === 'mañana' ? day : `el ${day}`;
      return `Te esperamos ${onDay} a las ${HOUR.format(start)}.`;
    }
    case 'en_juego':
      return `Tu horario termina a las ${HOUR.format(new Date(reserva.fin))}.`;
    case 'terminada':
      return 'Gracias por jugar.';
  }
}

/** Nombre de la cancha rentada, o `null` si el pedido no es renta. */
export function rentalCourtName(order: Pick<OrderDetail, 'reserva'>): string | null {
  return order.reserva?.espacio?.nombre ?? null;
}
