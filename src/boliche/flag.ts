// Bandera de las reservas de boliche del cliente. Apagada por defecto: solo se prende con
// VITE_FEATURE_RESERVAS_BOLICHE=true en el ambiente (Vercel o .env.local). Apagada, la renta
// sigue como siempre (todo dice «cancha» y no se piden jugadores). Es reversible sin tocar código.

/** Solo el texto exacto `true` (sin importar mayúsculas ni espacios) la prende. */
export function parseBowlingFlag(value: string | undefined | null): boolean {
  return value?.trim().toLowerCase() === 'true';
}

export const BOWLING_RESERVATIONS_ENABLED: boolean = parseBowlingFlag(import.meta.env.VITE_FEATURE_RESERVAS_BOLICHE);
