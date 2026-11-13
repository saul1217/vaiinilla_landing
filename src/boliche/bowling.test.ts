import { describe, expect, it } from 'vitest';
import { availableDurations, courtDurations, parseCourtDay, parseReservation } from '../lib/reservations';
import {
  MAX_PLAYERS,
  clampPlayers,
  isBowlingVenue,
  maxPlayers,
  playersForRequest,
  playersLabel,
  playersReady,
  rentalVocabulary,
} from './bowling';
import { parseBowlingFlag } from './flag';

const MIN = 60_000;

function rawDay(overrides: Record<string, unknown> = {}) {
  return {
    fecha: '2026-11-10',
    hoy: '2026-11-10',
    zona_horaria: 'America/Chihuahua',
    abre: '2026-11-10T16:00:00.000Z',
    cierra: '2026-11-11T05:00:00.000Z',
    bloque_min: 30,
    duraciones_min: [60, 120, 180],
    dias_adelanto: 14,
    apartado_min: 10,
    ahora: '2026-11-10T15:00:00.000Z',
    tipo_establecimiento: 'boliche',
    cerrado: false,
    canchas: [
      {
        espacio: { id: 3, nombre: null, tipo: 'cancha' },
        precio_hora: '200.00',
        rentable: true,
        capacidad: 6,
        duraciones_min: [180, 120],
        ocupado: [],
      },
      {
        espacio: { id: 4, nombre: 'Pista 2', tipo: 'cancha' },
        precio_hora: '200.00',
        rentable: true,
        capacidad: null,
        ocupado: [],
      },
    ],
    ...overrides,
  };
}

describe('bandera de boliche', () => {
  it('solo el texto true la prende', () => {
    expect(parseBowlingFlag('true')).toBe(true);
    expect(parseBowlingFlag(' TRUE ')).toBe(true);
    expect(parseBowlingFlag('1')).toBe(false);
    expect(parseBowlingFlag('false')).toBe(false);
    expect(parseBowlingFlag(undefined)).toBe(false);
    expect(parseBowlingFlag('')).toBe(false);
  });

  it('está apagada por defecto (sin la variable en el ambiente de pruebas)', () => {
    expect(isBowlingVenue('boliche')).toBe(false);
  });

  it('un boliche solo cuenta como tal con la bandera prendida', () => {
    expect(isBowlingVenue('boliche', true)).toBe(true);
    expect(isBowlingVenue('padel', true)).toBe(false);
    expect(isBowlingVenue(null, true)).toBe(false);
    expect(isBowlingVenue('boliche', false)).toBe(false);
  });
});

describe('vocabulario y jugadores', () => {
  it('en un boliche las canchas se llaman pistas', () => {
    expect(rentalVocabulary(true)).toEqual({ court: 'pista', courts: 'pistas', courtTitle: 'Pista', courtsTitle: 'Pistas' });
    expect(rentalVocabulary(false).court).toBe('cancha');
  });

  it('el tope es la capacidad de la pista, o 30 si no tiene', () => {
    expect(maxPlayers({ capacity: 6 })).toBe(6);
    expect(maxPlayers({ capacity: null })).toBe(MAX_PLAYERS);
    expect(maxPlayers({})).toBe(30);
    expect(maxPlayers(null)).toBe(30);
  });

  it('en un boliche no se aparta sin jugadores ni por encima de la capacidad', () => {
    expect(playersReady(true, 0, { capacity: 6 })).toBe(false);
    expect(playersReady(true, 1, { capacity: 6 })).toBe(true);
    expect(playersReady(true, 6, { capacity: 6 })).toBe(true);
    expect(playersReady(true, 7, { capacity: 6 })).toBe(false);
    // Fuera de un boliche no se piden.
    expect(playersReady(false, 0, null)).toBe(true);
  });

  it('los jugadores solo viajan en un boliche y si ya se anotaron', () => {
    expect(playersForRequest(true, 4)).toBe(4);
    expect(playersForRequest(true, 0)).toBeNull();
    expect(playersForRequest(false, 4)).toBeNull();
  });

  it('al cambiar a una pista más chica se ajustan al tope', () => {
    expect(clampPlayers(8, { capacity: 4 })).toBe(4);
    expect(clampPlayers(3, { capacity: 4 })).toBe(3);
    expect(clampPlayers(-2, null)).toBe(0);
  });

  it('dice jugador o jugadores', () => {
    expect(playersLabel(1)).toBe('1 jugador');
    expect(playersLabel(4)).toBe('4 jugadores');
  });
});

describe('contrato de la disponibilidad en un boliche', () => {
  it('con la bandera lee capacidad, duraciones por pista y cerrado', () => {
    const day = parseCourtDay(rawDay({ cerrado: true }), true);
    expect(day.bowling).toBe(true);
    expect(day.closed).toBe(true);
    expect(day.courts[0]).toMatchObject({ id: 3, name: 'Pista 3', capacity: 6, durations: [120, 180] });
    expect(day.courts[1]).toMatchObject({ id: 4, capacity: null, durations: [] });
  });

  it('sin la bandera el día se lee como siempre (canchas, sin datos de boliche)', () => {
    const day = parseCourtDay(rawDay(), false);
    expect(day.bowling).toBeUndefined();
    expect(day.closed).toBeUndefined();
    expect(day.courts[0]?.name).toBe('Cancha 3');
    expect(day.courts[0]).not.toHaveProperty('capacity');
    expect(day.courts[0]).not.toHaveProperty('durations');
  });

  it('en un boliche se ofrecen las duraciones de la pista; sin ellas, las del día', () => {
    const day = parseCourtDay(rawDay(), true);
    const [lane3, lane4] = day.courts;
    expect(courtDurations(day, lane3!)).toEqual([120, 180]);
    expect(courtDurations(day, lane4!)).toEqual([60, 120, 180]);
    expect(availableDurations(day, lane3!, day.opensAt)).toEqual([120, 180]);
  });

  it('fuera de un boliche las duraciones de cada cancha no cambian nada', () => {
    const day = parseCourtDay(rawDay(), false);
    const withLaneDurations = { ...day.courts[0]!, durations: [180] };
    expect(courtDurations(day, withLaneDurations)).toEqual([60, 120, 180]);
    expect(availableDurations(day, day.courts[0]!, day.opensAt + 30 * MIN)).toEqual([60, 120, 180]);
  });

  it('la reserva trae cuántos juegan', () => {
    const base = {
      id: 'r1',
      espacio: { id: 3, nombre: 'Pista 3' },
      inicio: '2026-11-10T18:00:00.000Z',
      fin: '2026-11-10T19:00:00.000Z',
      duracion_min: 60,
      monto: '200.00',
      estado: 'pendiente_pago',
    };
    expect(parseReservation({ ...base, jugadores: 5 }).players).toBe(5);
    expect(parseReservation({ ...base, jugadores: null }).players).toBeNull();
    expect(parseReservation(base).players).toBeNull();
  });
});
