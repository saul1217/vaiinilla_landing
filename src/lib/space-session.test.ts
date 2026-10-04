import { afterEach, describe, expect, it, vi } from 'vitest';
import { activeRentalSpace, entryAfterAccess, readSpace, rememberSpace, scannedSpace } from './space-session';

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

describe('mesa escaneada', () => {
  const mesa = { slug: 'usagi', espacioId: 4, nombre: 'Mesa 4', tipo: 'mesa', qrToken: 'esp_4' };

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sobrevive a que el teléfono cierre la app (otra pestaña, misma memoria del dispositivo)', () => {
    rememberSpace(mesa);
    sessionStorage.clear();
    expect(readSpace('usagi')).toEqual(mesa);
    expect(readSpace('otro-lugar')).toBeNull();
  });

  it('caduca a las 4 horas: una mesa de ayer no se queda pegada', () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse('2026-10-04T18:00:00Z'));
    rememberSpace(mesa);
    vi.setSystemTime(Date.parse('2026-10-04T21:59:00Z'));
    expect(scannedSpace()).toEqual(mesa);
    vi.setSystemTime(Date.parse('2026-10-04T22:01:00Z'));
    expect(scannedSpace()).toBeNull();
  });

  it('tras entrar o comprar sin cuenta vuelve al menú de la mesa, no al selector de lugar', () => {
    expect(entryAfterAccess('/pedir')).toBe('/pedir');
    rememberSpace(mesa);
    expect(entryAfterAccess('/pedir')).toBe('/e/usagi');
    expect(entryAfterAccess('/e/usagi/carrito')).toBe('/e/usagi/carrito');
  });
});
