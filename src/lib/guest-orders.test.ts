import { beforeEach, describe, expect, it } from 'vitest';
import { forgetGuestOrderByToken, forgetGuestOrdersBySlugs, readGuestOrders, rememberGuestOrder } from './guest-orders';

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

  it('al entregarse olvida solo el enlace de ese pedido', () => {
    rememberGuestOrder(link('t1'));
    rememberGuestOrder(link('t2'));
    forgetGuestOrderByToken('t1');
    expect(readGuestOrders().map((o) => o.token)).toEqual(['t2']);
    forgetGuestOrderByToken('no-existe');
    expect(readGuestOrders().map((o) => o.token)).toEqual(['t2']);
  });

  it('tras reclamar poda solo los enlaces de esos negocios', () => {
    rememberGuestOrder({ ...link('t1'), slug: 'padel' });
    rememberGuestOrder({ ...link('t2'), slug: 'tacos' });
    forgetGuestOrdersBySlugs(['padel']);
    expect(readGuestOrders().map((o) => o.token)).toEqual(['t2']);
    forgetGuestOrdersBySlugs([]);
    expect(readGuestOrders()).toHaveLength(1);
  });
});
