import { describe, expect, it } from 'vitest';
import {
  addDays,
  amountFor,
  availableDurations,
  busyUntil,
  canRentNow,
  clock,
  dayChipLabel,
  dayLongLabel,
  durationLabel,
  isFree,
  isStartAvailable,
  parseCourtDay,
  parseReservation,
  parseReservationPayment,
  startTimes,
  type CourtDay,
  type CourtSchedule,
} from './reservations';

const MIN = 60_000;
const T0 = Date.parse('2026-09-30T13:00:00Z'); // 07:00 en Chihuahua

function court(busy: Array<[number, number, string?]> = [], overrides: Partial<CourtSchedule> = {}): CourtSchedule {
  return {
    id: 7,
    name: 'Cancha 1',
    pricePerHour: '300.00',
    customerPricePerHour: { card: '300.00', cashOrBalance: '330.00' },
    rentable: true,
    busy: busy.map(([s, e, r]) => ({ start: T0 + s * MIN, end: T0 + e * MIN, reason: r ?? 'reserva' })),
    profile: { description: null, imageUrl: null, features: [] },
    ...overrides,
  };
}

function day(nowMin = 0, overrides: Partial<CourtDay> = {}): CourtDay {
  return {
    date: '2026-09-30',
    today: '2026-09-30',
    timeZone: 'America/Chihuahua',
    opensAt: T0,
    closesAt: T0 + 16 * 60 * MIN,
    blockMinutes: 30,
    durations: [60, 90, 120],
    daysAhead: 14,
    holdMinutes: 10,
    now: T0 + nowMin * MIN,
    courts: [],
    ...overrides,
  };
}

describe('horarios de una cancha', () => {
  it('ofrece inicios cada 30 min mientras quepa la duración más corta', () => {
    const starts = startTimes(day());
    expect(starts[0]).toBe(T0);
    expect(starts.length).toBe(31); // 07:00 a 22:00
    expect(starts.at(-1)).toBe(T0 + 15 * 60 * MIN);
  });

  it('hoy solo desde el siguiente bloque', () => {
    const starts = startTimes(day(100));
    expect(starts[0]).toBe(T0 + 120 * MIN);
  });

  it('una duración cabe solo si no toca lo ocupado ni se sale del horario', () => {
    const c = court([[120, 180]]);
    const d = day();
    expect(isFree(d, c, T0 + 60 * MIN, 60)).toBe(true);
    expect(isFree(d, c, T0 + 60 * MIN, 90)).toBe(false);
    expect(isFree(d, c, T0 + 180 * MIN, 60)).toBe(true); // pegado después
    expect(isFree(d, c, T0 + 15.5 * 60 * MIN, 60)).toBe(false); // pasa del cierre
    expect(availableDurations(d, c, T0 + 30 * MIN)).toEqual([60, 90]);
    expect(availableDurations(d, c, T0 + 60 * MIN)).toEqual([60]);
    expect(isStartAvailable(d, c, T0 + 90 * MIN)).toBe(false);
  });

  it('une un turno seguido de una reserva y dice hasta cuándo está ocupada', () => {
    const c = court([[0, 60, 'turno'], [60, 150, 'reserva'], [300, 360]]);
    expect(busyUntil(c, T0 + 10 * MIN)).toBe(T0 + 150 * MIN);
    expect(busyUntil(c, T0 + 200 * MIN)).toBeNull();
    expect(busyUntil(c, T0 + 150 * MIN)).toBeNull();
  });

  it('"Rentar ahora" solo hoy, rentable y con espacio libre', () => {
    const d = day(100);
    expect(canRentNow(d, court())).toBe(true);
    expect(canRentNow(d, court([[90, 200]]))).toBe(false);
    expect(canRentNow(d, court([], { rentable: false }))).toBe(false);
    expect(canRentNow(day(100, { date: '2026-10-01' }), court())).toBe(false);
  });

  it('el monto es precio × minutos / 60 con la mitad hacia arriba', () => {
    expect(amountFor('330.00', 60)).toBe('330.00');
    expect(amountFor('330.00', 90)).toBe('495.00');
    expect(amountFor('250.00', 150)).toBe('625.00');
    expect(amountFor('100.01', 90)).toBe('150.02'); // 150.015 → .02
    expect(amountFor('abc', 60)).toBeNull();
  });
});

describe('texto', () => {
  it('días, duraciones y cuenta atrás', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(dayChipLabel('2026-09-30', '2026-09-30')).toBe('Hoy');
    expect(dayChipLabel('2026-10-01', '2026-09-30')).toBe('Mañana');
    expect(dayChipLabel('2026-10-03', '2026-09-30')).toBe('sáb 3 oct');
    expect(dayLongLabel('2026-10-03', '2026-09-30')).toBe('sábado 3 de octubre');
    expect(durationLabel(60)).toBe('1 h');
    expect(durationLabel(90)).toBe('1 h 30');
    expect(durationLabel(45)).toBe('45 min');
    expect(clock(9 * 60_000 + 59_000)).toBe('9:59');
    expect(clock(-5)).toBe('0:00');
  });
});

describe('lectura del contrato', () => {
  it('lee el día con ficha, precios al cliente y ocupado', () => {
    const parsed = parseCourtDay({
      fecha: '2026-10-01',
      hoy: '2026-09-30',
      zona_horaria: 'America/Chihuahua',
      abre: '2026-10-01T13:00:00.000Z',
      cierra: '2026-10-02T05:00:00.000Z',
      bloque_min: 30,
      duraciones_min: [60, 90],
      dias_adelanto: 14,
      apartado_min: 10,
      ahora: '2026-09-30T20:00:00.000Z',
      canchas: [
        {
          espacio: { id: 7, nombre: 'Cancha 1', tipo: 'cancha' },
          ficha: { descripcion: 'Techada', imagen_url: 'https://x/y.jpg', caracteristicas: ['Con luz', ''] },
          precio_hora: '300.00',
          precio_hora_cliente: { tarjeta: '300.00', efectivo_saldo: '330.00' },
          rentable: true,
          ocupado: [{ inicio: '2026-10-01T14:00:00.000Z', fin: '2026-10-01T15:00:00.000Z', motivo: 'turno' }],
        },
        { espacio: { id: 8, nombre: 'Cancha 2' }, rentable: false },
      ],
    });
    expect(parsed.durations).toEqual([60, 90]);
    expect(parsed.courts[0]).toMatchObject({
      id: 7,
      rentable: true,
      customerPricePerHour: { card: '300.00', cashOrBalance: '330.00' },
      profile: { description: 'Techada', imageUrl: 'https://x/y.jpg', features: ['Con luz'] },
    });
    expect(parsed.courts[0]?.busy[0]).toMatchObject({ reason: 'turno', end: Date.parse('2026-10-01T15:00:00.000Z') });
    expect(parsed.courts[1]).toMatchObject({ rentable: false, busy: [], profile: { imageUrl: null, features: [] } });
  });

  it('una fecha inválida no pasa en silencio', () => {
    expect(() => parseCourtDay({ abre: 'ayer', cierra: 'x', ahora: 'y' })).toThrow(/fecha inválida/);
  });

  it('lee una reserva y su pago con el pedido', () => {
    const reserva = {
      id: 'r1',
      espacio: { id: 7, nombre: 'Cancha 1', tipo: 'cancha' },
      inicio: '2026-10-01T14:00:00Z',
      fin: '2026-10-01T15:30:00Z',
      duracion_min: 90,
      monto: '450.00',
      precio_cliente: { tarjeta: '450.00', efectivo_saldo: '495.00' },
      estado: 'pendiente_pago',
      expira_en: '2026-09-30T20:10:00Z',
      pedido_id: null,
      canal: 'cliente',
      version: 1,
    };
    expect(parseReservation(reserva)).toMatchObject({
      id: 'r1',
      courtId: 7,
      state: 'pendiente_pago',
      holdExpiresAt: Date.parse('2026-09-30T20:10:00Z'),
      customerPrice: { card: '450.00', cashOrBalance: '495.00' },
    });
    const payment = parseReservationPayment({ reserva, pedido: { id: 'p1', folio: 3 }, cobro: null });
    expect(payment.order?.id).toBe('p1');
    expect(parseReservationPayment({ reserva, pedido: null }).order).toBeNull();
  });

  it('un estado desconocido se trata como conflicto, no como pagada', () => {
    expect(parseReservation({ id: 'r', espacio: { id: 1 }, inicio: '2026-10-01T14:00:00Z', fin: '2026-10-01T15:00:00Z' }).state).toBe('conflicto');
  });
});
