import { describe, expect, it } from 'vitest';
import { VaiinillaApiError } from './api-error';
import { isPermanentTrackingError, trackingRetryDelay } from './tracking-poll';

describe('reintentos del seguimiento', () => {
  it('espera cada vez más tras errores seguidos, con tope de un minuto', () => {
    const middle = () => 0.5;
    expect(trackingRetryDelay(1, middle)).toBe(5000);
    expect(trackingRetryDelay(2, middle)).toBe(10_000);
    expect(trackingRetryDelay(3, middle)).toBe(20_000);
    expect(trackingRetryDelay(10, middle)).toBe(60_000);
  });

  it('reparte las pestañas en el tiempo (±20 %) para no golpear juntas', () => {
    expect(trackingRetryDelay(1, () => 0)).toBe(4000);
    expect(trackingRetryDelay(1, () => 1)).toBe(6000);
  });

  it('deja de preguntar si el enlace ya no existe, pero no ante una caída', () => {
    expect(isPermanentTrackingError(new VaiinillaApiError(404, { code: 'NOT_FOUND', message: '' }))).toBe(true);
    expect(isPermanentTrackingError(new VaiinillaApiError(503, { code: 'BACKEND_UNAVAILABLE', message: '' }))).toBe(false);
    expect(isPermanentTrackingError(new Error('red'))).toBe(false);
  });
});
