import { describe, expect, it } from 'vitest';
import { activeRentalSpace } from './space-session';

const now = Date.parse('2026-10-02T20:00:00Z');
const rental = (over: object) => ({ courtId: 3, courtName: 'Cancha 1', start: now - 30 * 60_000, end: now + 30 * 60_000, state: 'confirmada', ...over });

describe('renta activa → pedido a la cancha', () => {
  it('con la renta en curso la comida va a esa cancha, sin QR', () => {
    expect(activeRentalSpace('padel', [rental({})], now)).toEqual({ slug: 'padel', espacioId: 3, nombre: 'Cancha 1', tipo: 'cancha' });
  });

  it('una renta que no ha empezado, que ya terminó o sin pagar no cuenta', () => {
    expect(activeRentalSpace('padel', [rental({ start: now + 60_000 })], now)).toBeNull();
    expect(activeRentalSpace('padel', [rental({ end: now })], now)).toBeNull();
    expect(activeRentalSpace('padel', [rental({ state: 'pendiente_pago' })], now)).toBeNull();
    expect(activeRentalSpace('padel', [], now)).toBeNull();
  });
});
