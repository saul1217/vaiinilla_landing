import { beforeEach, describe, expect, it } from 'vitest';
import { readGuestOrders, rememberGuestOrder } from './guest-orders';

const link = (token: string, createdAt = Date.now()) => ({ token, slug: 'a', folio: 1, placeName: 'A', createdAt });

describe('enlaces de seguimiento guardados', () => {
  beforeEach(() => localStorage.clear());

  it('guarda el más nuevo primero, sin duplicar, y olvida los de hace más de una semana', () => {
    rememberGuestOrder(link('t1'));
    rememberGuestOrder(link('t2'));
    rememberGuestOrder(link('t1'));
    expect(readGuestOrders().map((o) => o.token)).toEqual(['t1', 't2']);
    rememberGuestOrder(link('viejo', Date.now() - 8 * 24 * 3600 * 1000));
    expect(readGuestOrders().map((o) => o.token)).not.toContain('viejo');
  });
});
