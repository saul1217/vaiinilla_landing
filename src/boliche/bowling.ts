// Reservas de boliche del cliente: espejo de VenueContext y ReservationsViewModel (Android, R11 y
// R25). Una pista es una cancha del servidor (`tipo: cancha`) en un negocio `tipo: boliche`: se
// renta igual, pero se llama «pista», cada pista trae sus duraciones y su capacidad, y para
// apartarla hay que decir cuántos juegan (`jugadores`, obligatorio en el backend: 422
// PLAYERS_REQUIRED). Contrato: vaiinilla_back docs/reservas-cancha.md, «Boliche: pistas».
import { BOWLING_RESERVATIONS_ENABLED } from './flag';

/** Tope de jugadores cuando la pista no tiene capacidad propia (contrato C del backend). */
export const MAX_PLAYERS = 30;

/** El negocio es boliche y la bandera está prendida. */
export function isBowlingVenue(
  businessType: string | null | undefined,
  enabled: boolean = BOWLING_RESERVATIONS_ENABLED,
): boolean {
  return enabled && businessType === 'boliche';
}

export interface RentalVocabulary {
  /** «cancha» o «pista». */
  court: string;
  /** «canchas» o «pistas». */
  courts: string;
  /** «Cancha» o «Pista». */
  courtTitle: string;
  /** «Canchas» o «Pistas». */
  courtsTitle: string;
}

const COURT_WORDS: RentalVocabulary = { court: 'cancha', courts: 'canchas', courtTitle: 'Cancha', courtsTitle: 'Canchas' };
const LANE_WORDS: RentalVocabulary = { court: 'pista', courts: 'pistas', courtTitle: 'Pista', courtsTitle: 'Pistas' };

export function rentalVocabulary(bowling: boolean): RentalVocabulary {
  return bowling ? LANE_WORDS : COURT_WORDS;
}

/** Cuántos caben en la pista: su capacidad, o 30 si no tiene. */
export function maxPlayers(court: { capacity?: number | null } | null | undefined): number {
  const capacity = court?.capacity;
  return typeof capacity === 'number' && capacity > 0 ? capacity : MAX_PLAYERS;
}

/** En un boliche no se aparta sin saber cuántos juegan, de 1 a la capacidad de la pista. */
export function playersReady(
  bowling: boolean,
  players: number,
  court: { capacity?: number | null } | null | undefined,
): boolean {
  return !bowling || (players >= 1 && players <= maxPlayers(court));
}

/** Los jugadores que van en `POST /reservas`: solo en un boliche y si ya se anotaron. */
export function playersForRequest(bowling: boolean, players: number): number | null {
  return bowling && players > 0 ? players : null;
}

/** Ajusta los jugadores al tope de otra pista (R25: otra pista puede tener otra capacidad). */
export function clampPlayers(players: number, court: { capacity?: number | null } | null | undefined): number {
  return Math.max(0, Math.min(Math.round(players), maxPlayers(court)));
}

/** "1 jugador", "4 jugadores". */
export function playersLabel(players: number): string {
  return `${players} ${players === 1 ? 'jugador' : 'jugadores'}`;
}
