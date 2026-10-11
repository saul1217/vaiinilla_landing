import { describe, expect, it } from 'vitest';
import { VaiinillaApiError } from './api-error';
import { isGoneTracking, isSettledOrder } from './guest-order-check';

describe('guest-order-check', () => {
  it('404 y 410 del seguimiento significan que el pedido ya no existe', () => {
    expect(isGoneTracking(new VaiinillaApiError(404, { code: 'NOT_FOUND', message: 'x' }))).toBe(true);
    expect(isGoneTracking(new VaiinillaApiError(410, { code: 'GONE', message: 'x' }))).toBe(true);
    expect(isGoneTracking(new VaiinillaApiError(500, { code: 'X', message: 'x' }))).toBe(false);
    expect(isGoneTracking(new Error('red'))).toBe(false);
  });

  it('cancelado, no recogido y expirado salen; los activos no', () => {
    expect(isSettledOrder({ estado: 'cancelado' })).toBe(true);
    expect(isSettledOrder({ estado: 'expirado' })).toBe(true);
    expect(isSettledOrder({ estado: 'preparando' })).toBe(false);
  });
});
