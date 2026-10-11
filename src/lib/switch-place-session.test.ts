import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientContextResponse, PublicEstablishment } from '../types/api';

const { getEstablishment, listAccesses, firebaseIdToken } = vi.hoisted(() => ({
  getEstablishment: vi.fn(),
  listAccesses: vi.fn(),
  firebaseIdToken: vi.fn(),
}));

vi.mock('./api', () => ({
  api: {
    getEstablishment: (...args: unknown[]) => getEstablishment(...args) as Promise<unknown>,
    listAccesses: (...args: unknown[]) => listAccesses(...args) as Promise<unknown>,
  },
}));

vi.mock('./firebase', () => ({
  firebaseIdToken: (...args: unknown[]) => firebaseIdToken(...args) as Promise<unknown>,
}));

import { readCart, writeCart } from './cart-storage';
import { resolveClientSession } from './client-session';
import { lastPlaceSlug, rememberPlace, rememberPlaceFromSession } from './last-place';
import { leavePlace } from './switch-place';

const place: PublicEstablishment = {
  id: 'e1',
  nombre: 'USAGI',
  slug: 'cafeteria-usagi',
  identificador_cliente_etiqueta: 'Cliente',
  identificador_cliente_obligatorio: false,
};

const context = {
  access_token: 'jwt-live',
  token_type: 'Bearer',
  expires_in: 3600,
  contexto: { usuario_id: 'u1', membresia_id: 'm1', establecimiento_id: 'e1', rol: 'cliente', modo_restringido: null },
} as ClientContextResponse;

const user = { uid: 'u1' } as never;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  getEstablishment.mockResolvedValue(place);
  firebaseIdToken.mockResolvedValue('fb');
});

describe('cambiar tienda con sesión iniciada', () => {
  it('una sesión de cliente que ya iba en vuelo no vuelve a recordar la tienda', async () => {
    rememberPlace('cafeteria-usagi');
    const openClientSession = vi.fn().mockResolvedValue(context);
    const pending = resolveClientSession({ user, context: null, preferredSlug: 'cafeteria-usagi', openClientSession });

    leavePlace();
    await pending;

    expect(lastPlaceSlug()).toBeNull();
  });

  it('con contexto vigente de la tienda anterior tampoco la recuerda de vuelta', async () => {
    rememberPlace('cafeteria-usagi');
    leavePlace();

    await resolveClientSession({ user, context, preferredSlug: 'cafeteria-usagi', openClientSession: vi.fn() });
    rememberPlaceFromSession('cafeteria-usagi');

    expect(lastPlaceSlug()).toBeNull();
  });

  it('elegir otra tienda de forma explícita la vuelve a recordar', async () => {
    leavePlace();
    rememberPlace('demo-a');
    getEstablishment.mockResolvedValue({ ...place, slug: 'demo-a' });
    await resolveClientSession({
      user,
      context: null,
      preferredSlug: 'demo-a',
      openClientSession: vi.fn().mockResolvedValue(context),
    });
    expect(lastPlaceSlug()).toBe('demo-a');
  });
});

describe('cambiar tienda con carrito', () => {
  it('borra el carrito de la tienda anterior', () => {
    writeCart({ slug: 'cafeteria-usagi', establishmentName: 'USAGI', lines: [] });
    expect(readCart()).not.toBeNull();

    leavePlace();

    expect(readCart()).toBeNull();
  });
});
