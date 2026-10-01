// Canchas simuladas para /__qa/canchas y las pruebas: sigue el contrato de
// vaiinilla_back docs/reservas-cancha.md (horario del día, apartar 10 minutos, pagar, cancelar).
import type { ReservationsClient } from './use-reservations';
import type { CourtDay, Reservation } from './reservations';
import { amountFor } from './reservations';

const MIN = 60_000;

export function createMockReservationsClient(options: { photoUrl?: string | null } = {}): ReservationsClient {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = Date.now();
  const at = (date: string, hour: number, minute = 0) => {
    // Hora local del navegador en la fecha dada; basta para ver el flujo.
    const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
    return new Date(y, m - 1, d, hour, minute).getTime();
  };
  const todayLocal = new Date(now);
  const today = `${todayLocal.getFullYear()}-${String(todayLocal.getMonth() + 1).padStart(2, '0')}-${String(todayLocal.getDate()).padStart(2, '0')}`;
  let counter = 0;
  let mine: Reservation[] = [];
  const wait = (ms = 380) => new Promise((resolve) => setTimeout(resolve, ms));

  function day(date?: string): CourtDay {
    const d = date ?? today;
    const busy2 = [
      { start: at(d, 18), end: at(d, 19, 30), reason: 'reserva' },
      { start: at(d, 20), end: at(d, 21), reason: 'turno' },
    ];
    const busy1 = mine
      .filter((r) => r.state === 'pendiente_pago' || r.state === 'confirmada')
      .map((r) => ({ start: r.start, end: r.end, reason: 'reserva' }));
    return {
      date: d,
      today,
      timeZone: zone,
      opensAt: at(d, 7),
      closesAt: at(d, 23),
      blockMinutes: 30,
      durations: [60, 90, 120, 150, 180],
      daysAhead: 14,
      holdMinutes: 10,
      now: Date.now(),
      courts: [
        {
          id: 4,
          name: 'Cancha 1',
          pricePerHour: '300.00',
          customerPricePerHour: { card: '300.00', cashOrBalance: '330.00' },
          rentable: true,
          busy: busy1,
          profile: {
            description: 'Cancha techada con cristal panorámico. Ideal para jugar de noche.',
            imageUrl: options.photoUrl ?? null,
            features: ['Techada', 'Con luz', 'Cristal'],
          },
        },
        {
          id: 5,
          name: 'Cancha 2',
          pricePerHour: '250.00',
          customerPricePerHour: { card: '250.00', cashOrBalance: '275.00' },
          rentable: true,
          busy: d === today ? [{ start: at(d, 0), end: now + 25 * MIN, reason: 'turno' }, ...busy2] : busy2,
          profile: { description: null, imageUrl: null, features: [] },
        },
      ],
    };
  }

  return {
    async day(date) {
      await wait();
      return day(date);
    },
    async list() {
      await wait(120);
      return mine;
    },
    async create(input) {
      await wait(700);
      const start = input.start ?? Date.now();
      const court = day().courts.find((c) => c.id === input.courtId);
      const price = court?.customerPricePerHour?.cashOrBalance ?? '0.00';
      const reservation: Reservation = {
        id: `qa-res-${++counter}`,
        courtId: input.courtId,
        courtName: court?.name ?? 'Cancha',
        start,
        end: start + input.durationMinutes * MIN,
        durationMinutes: input.durationMinutes,
        amount: amountFor(court?.pricePerHour ?? '0.00', input.durationMinutes) ?? '0.00',
        customerPrice: {
          card: amountFor(court?.customerPricePerHour?.card ?? '0.00', input.durationMinutes) ?? '0.00',
          cashOrBalance: amountFor(price, input.durationMinutes) ?? '0.00',
        },
        state: 'pendiente_pago',
        holdExpiresAt: Date.now() + 10 * MIN,
        orderId: null,
        channel: 'cliente',
        version: 1,
      };
      mine = [reservation, ...mine];
      return reservation;
    },
    async pay(id) {
      await wait(900);
      const found = mine.find((r) => r.id === id);
      if (!found) throw new Error('No encontramos la reserva.');
      const paid: Reservation = { ...found, state: 'confirmada', holdExpiresAt: null };
      mine = mine.map((r) => (r.id === id ? paid : r));
      return { reservation: paid, order: null };
    },
    async cancel(id) {
      await wait(500);
      const found = mine.find((r) => r.id === id);
      if (!found) throw new Error('No encontramos la reserva.');
      const cancelled: Reservation = { ...found, state: 'cancelada', holdExpiresAt: null };
      mine = mine.map((r) => (r.id === id ? cancelled : r));
      return cancelled;
    },
  };
}
