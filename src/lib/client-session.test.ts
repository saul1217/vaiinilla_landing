import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientContextResponse, PublicEstablishment, SessionAccess } from '../types/api';

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

import {
  clearStoredClientContext,
  pickClientAccess,
  readStoredClientContext,
  resolveClientSession,
  writeStoredClientContext,
} from './client-session';

const place: PublicEstablishment = {
  id: 'e1',
  nombre: 'Renasci',
  slug: 'renasci-bar',
  identificador_cliente_etiqueta: 'Cliente',
  identificador_cliente_obligatorio: false,
};

const session = {
  access_token: 'jwt-live',
  token_type: 'Bearer',
  expires_in: 3600,
  contexto: {
    usuario_id: 'u1',
    membresia_id: 'm1',
    establecimiento_id: 'e1',
    rol: 'cliente',
    modo_restringido: null,
  },
} as ClientContextResponse;

const clientAccess: SessionAccess = {
  membresia_id: 'm1',
  establecimiento: { id: 'e1', nombre: 'Renasci', slug: 'renasci-bar' },
  rol: 'cliente',
  identificador_cliente: 'A1',
  estado_establecimiento: 'activo',
  cierre_operativo_disponible: false,
};

describe('pickClientAccess', () => {
  it('elige el cliente activo del slug preferido', () => {
    const staff: SessionAccess = {
      ...clientAccess,
      membresia_id: 'm2',
      rol: 'cajero',
      establecimiento: { id: 'e2', nombre: 'Otra', slug: 'otra' },
    };
    expect(pickClientAccess([staff, clientAccess], 'renasci-bar')).toEqual(clientAccess);
  });

  it('si no hay slug, usa el primer cliente activo', () => {
    expect(pickClientAccess([clientAccess])).toEqual(clientAccess);
    expect(pickClientAccess([{ ...clientAccess, estado_establecimiento: 'suspendido' }])).toBeNull();
  });
});

describe('stored client context', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('guarda y lee el JWT de contexto-cliente', () => {
    writeStoredClientContext(session, 'renasci-bar');
    expect(readStoredClientContext()).toMatchObject({
      context: session,
      slug: 'renasci-bar',
    });
  });

  it('descarta el JWT vencido', () => {
    writeStoredClientContext({ ...session, expires_in: 0 }, 'renasci-bar');
    const raw = sessionStorage.getItem('vaiinilla.buyer.client-context.v1');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw ?? '{}') as { expiresAt: number };
    parsed.expiresAt = Date.now() - 1;
    sessionStorage.setItem('vaiinilla.buyer.client-context.v1', JSON.stringify(parsed));
    expect(readStoredClientContext()).toBeNull();
  });

  it('limpia el store', () => {
    writeStoredClientContext(session, 'renasci-bar');
    clearStoredClientContext();
    expect(readStoredClientContext()).toBeNull();
  });
});

describe('resolveClientSession', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    getEstablishment.mockReset();
    listAccesses.mockReset();
    firebaseIdToken.mockReset();
    getEstablishment.mockResolvedValue(place);
    listAccesses.mockResolvedValue([clientAccess]);
    firebaseIdToken.mockResolvedValue('firebase-token');
  });

  it('reusa el contexto si ya es del establecimiento pedido', async () => {
    const openClientSession = vi.fn();
    const resolved = await resolveClientSession({
      user: { uid: 'u1' } as never,
      context: session,
      preferredSlug: 'renasci-bar',
      openClientSession,
    });
    expect(resolved).toEqual({ context: session, slug: 'renasci-bar', place });
    expect(openClientSession).not.toHaveBeenCalled();
    expect(listAccesses).not.toHaveBeenCalled();
  });

  it('abre contexto-cliente cuando no hay sesión en memoria', async () => {
    const openClientSession = vi.fn().mockResolvedValue(session);
    const resolved = await resolveClientSession({
      user: { uid: 'u1' } as never,
      context: null,
      preferredSlug: 'renasci-bar',
      openClientSession,
    });
    expect(openClientSession).toHaveBeenCalledWith({ uid: 'u1' }, place);
    expect(resolved?.context.access_token).toBe('jwt-live');
  });

  it('sin slug usa accesos reales del token Firebase, no fixtures', async () => {
    const openClientSession = vi.fn().mockResolvedValue(session);
    const resolved = await resolveClientSession({
      user: { uid: 'u1' } as never,
      context: null,
      preferredSlug: null,
      openClientSession,
    });
    expect(firebaseIdToken).toHaveBeenCalled();
    expect(listAccesses).toHaveBeenCalledWith('firebase-token');
    expect(openClientSession).toHaveBeenCalledWith({ uid: 'u1' }, place);
    expect(resolved?.slug).toBe('renasci-bar');
    expect(localStorage.getItem('vaiinilla.buyer.last-place.v1')).toBe('renasci-bar');
  });

  it('sin accesos de cliente no fabrica historial ni saldo', async () => {
    listAccesses.mockResolvedValue([]);
    const openClientSession = vi.fn();
    await expect(
      resolveClientSession({
        user: { uid: 'u1' } as never,
        context: null,
        preferredSlug: null,
        openClientSession,
      }),
    ).resolves.toBeNull();
    expect(openClientSession).not.toHaveBeenCalled();
  });
});
