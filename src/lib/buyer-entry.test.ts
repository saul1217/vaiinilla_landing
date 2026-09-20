import { describe, expect, it } from 'vitest';
import { buyerEntryPath, markBuyerExplore } from './buyer-entry';
import { rememberPlace } from './last-place';
import { isGuestExplore } from './guest-explore';

describe('buyerEntryPath', () => {
  it('va al picker si no hay cafetería recordada', () => {
    localStorage.clear();
    sessionStorage.clear();
    expect(buyerEntryPath()).toBe('/pedir');
  });

  it('usa el slug del carrito o el último guardado', () => {
    localStorage.clear();
    sessionStorage.clear();
    rememberPlace('venecia');
    expect(buyerEntryPath()).toBe('/e/venecia');
    expect(buyerEntryPath('renasci-bar')).toBe('/e/renasci-bar');
  });

  it('marca exploración de invitado para saltar el splash', () => {
    sessionStorage.clear();
    markBuyerExplore();
    expect(isGuestExplore()).toBe(true);
  });
});
