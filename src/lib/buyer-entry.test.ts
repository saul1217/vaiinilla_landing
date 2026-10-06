import { describe, expect, it } from 'vitest';
import { buyerEntryPath, markBuyerExplore } from './buyer-entry';
import { rememberPlace } from './last-place';
import { rememberSpace } from './space-session';
import { isGuestExplore } from './guest-explore';

describe('buyerEntryPath', () => {
  it('va al picker si no hay establecimiento recordado', () => {
    localStorage.clear();
    sessionStorage.clear();
    expect(buyerEntryPath()).toBe('/pedir');
  });

  it('un lugar visitado antes no se asume: pregunta QR o código', () => {
    localStorage.clear();
    sessionStorage.clear();
    rememberPlace('padel-pruebas');
    expect(buyerEntryPath()).toBe('/pedir');
  });

  it('con pedido en curso vuelve a esa tienda: carrito o mesa escaneada', () => {
    localStorage.clear();
    sessionStorage.clear();
    expect(buyerEntryPath('renasci-bar')).toBe('/e/renasci-bar');
    rememberSpace({ slug: 'venecia', espacioId: 1, nombre: 'Mesa 1', tipo: 'mesa' });
    expect(buyerEntryPath()).toBe('/e/venecia');
  });

  it('marca exploración de invitado para saltar el splash', () => {
    sessionStorage.clear();
    markBuyerExplore();
    expect(isGuestExplore()).toBe(true);
  });
});
