import { VaiinillaApiError } from './api-error';

const BASE_RETRY_MS = 5000;
const MAX_RETRY_MS = 60_000;

/**
 * Tras un error del seguimiento se espera cada vez más (5 s, 10 s, 20 s… hasta 1 min) y con
 * algo de azar, para que las pestañas abiertas no golpeen juntas al backend mientras se recupera.
 */
export function trackingRetryDelay(failures: number, random: () => number = Math.random): number {
  const base = Math.min(BASE_RETRY_MS * 2 ** Math.max(0, failures - 1), MAX_RETRY_MS);
  return Math.round(base * (0.8 + random() * 0.4));
}

/** Un enlace de seguimiento que ya no existe no se arregla solo: se deja de preguntar. */
export function isPermanentTrackingError(cause: unknown): boolean {
  return cause instanceof VaiinillaApiError && (cause.status === 404 || cause.status === 410);
}
