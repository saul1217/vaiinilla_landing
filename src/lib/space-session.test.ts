import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rememberPlace, forgetPlace } from './last-place';
import {
  activeRentalSpace,
  entryAfterAccess,
  guestEntryAfterAccess,
  readSpace,
  rememberSpace,
  requiresAccount,
  scannedSpace,
} from './space-session';

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

describe('comprar sin cuenta desde una ruta que pide cuenta', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    forgetPlace();
  });

  it('saldo, detalle de pedido y QR personal piden cuenta; el menú y el carrito no', () => {
    expect(requiresAccount('/cuenta/saldo')).toBe(true);
    expect(requiresAccount('/cuenta/pedidos/42')).toBe(true);
    expect(requiresAccount('/u/abc')).toBe(true);
    expect(requiresAccount('/cuenta/pedidos')).toBe(false);
    expect(requiresAccount('/e/padel/carrito')).toBe(false);
  });

  it('desde Cartera el invitado va al último lugar, no de vuelta al splash', () => {
    expect(guestEntryAfterAccess('/cuenta/saldo')).toBe('/pedir');
    rememberPlace('padel');
    expect(guestEntryAfterAccess('/cuenta/saldo')).toBe('/e/padel');
    expect(guestEntryAfterAccess('/cuenta/pedidos/9')).toBe('/e/padel');
  });

  it('con mesa escaneada gana la mesa; las rutas sin cuenta siguen igual', () => {
    rememberPlace('padel');
    rememberSpace({ slug: 'usagi', espacioId: 1, nombre: 'Mesa 1', tipo: 'mesa' });
    expect(guestEntryAfterAccess('/u/abc')).toBe('/e/usagi');
    expect(guestEntryAfterAccess('/e/padel/carrito')).toBe('/e/padel/carrito');
  });
});
