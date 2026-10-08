import { beforeEach, describe, expect, it } from 'vitest';
import { clearCart, readCart, writeCart } from './cart-storage';
import { forgetGuestOrdersForSession, readGuestOrders, rememberGuestOrder } from './guest-orders';
import { readSpace, rememberSpace } from './space-session';
import { clearClosedTableSession, observeTableSession } from './table-session-cleanup';
import { forgetTableParticipant, readTableParticipant, rememberTableParticipant } from './table-participant';

const slug = 'demo';
const sessionA = 'session-a';
const sessionB = 'session-b';

function rememberSession(sessionId: string) {
  rememberSpace({ slug, espacioId: 67, nombre: 'Mesa 67', tipo: 'mesa', sesionId: sessionId, qrToken: 'qr' });
  rememberTableParticipant({ slug, espacioId: 67, sesionId: sessionId, participanteId: `p-${sessionId}`, alias: 'Kikin' });
  writeCart({ slug, establishmentName: 'Demo', sessionId, spaceId: 67, lines: [] });
  rememberGuestOrder({ token: `tracking-${sessionId}`, slug, folio: 1, placeName: 'Demo', createdAt: Date.now(), destination: 'en_espacio', sessionId });
}

describe('limpieza local de sesiones de mesa', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('un currentTable nulo sin contexto previo no rompe ni borra un carrito no asociado', () => {
    writeCart({ slug, establishmentName: 'Demo', lines: [] });

    expect(() => clearClosedTableSession()).not.toThrow();
    expect(readCart()?.slug).toBe(slug);
  });

  it('al cerrar elimina solo identidad, carrito, contexto y links de esa sesión', () => {
    rememberSession(sessionA);
    rememberGuestOrder({ token: 'takeout', slug, folio: 2, placeName: 'Demo', createdAt: Date.now(), destination: 'para_llevar' });

    clearClosedTableSession(slug, 67);

    expect(readTableParticipant()).toBeNull();
    expect(readCart()).toBeNull();
    expect(readSpace(slug)).toBeNull();
    expect(readGuestOrders().map((item) => item.token)).toEqual(['takeout']);
  });

  it('al confirmar una nueva sesión descarta los artefactos de la anterior y liga el carrito a la nueva', () => {
    rememberSession(sessionA);

    const staleCartRemoved = observeTableSession(sessionB, {
      slug, espacioId: 67, nombre: 'Mesa 67', tipo: 'mesa', sesionId: sessionB,
    });

    expect(staleCartRemoved).toBe(true);
    expect(readTableParticipant()).toBeNull();
    expect(readCart()).toBeNull();
    expect(readSpace(slug)?.sesionId).toBe(sessionB);
    expect(readGuestOrders()).toEqual([]);
    forgetGuestOrdersForSession(sessionB);
    clearCart();
    forgetTableParticipant();
  });

  it('una limpieza tardía de A no borra el carrito ni el espacio de la nueva sesión B', () => {
    rememberSession(sessionA);
    rememberSpace({ slug, espacioId: 67, nombre: 'Mesa 67', tipo: 'mesa', sesionId: sessionB, qrToken: 'qr' });
    writeCart({ slug, establishmentName: 'Demo', sessionId: sessionB, spaceId: 67, lines: [] });

    clearClosedTableSession(slug, 67);

    expect(readCart()?.sessionId).toBe(sessionB);
    expect(readSpace(slug)?.sesionId).toBe(sessionB);
    expect(readTableParticipant()).toBeNull();
    expect(readGuestOrders()).toEqual([]);
  });
});
