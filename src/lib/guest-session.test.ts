import { beforeEach, describe, expect, it, vi } from 'vitest';
import { guestSession, readGuest } from './guest-session';

const { createGuest, renewGuest, getLegalVersions } = vi.hoisted(() => ({
  createGuest: vi.fn(),
  renewGuest: vi.fn(),
  getLegalVersions: vi.fn(),
}));

vi.mock('./api', () => ({
  api: {
    createGuest: (...args: unknown[]) => createGuest(...args) as Promise<unknown>,
    renewGuest: (...args: unknown[]) => renewGuest(...args) as Promise<unknown>,
    getLegalVersions: (...args: unknown[]) => getLegalVersions(...args) as Promise<unknown>,
  },
}));

const LEGAL = { terminos_version: 't-1', terminos_url: '/t', privacidad_version: 'p-1', privacidad_url: '/p' };

describe('guest-session', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    createGuest.mockReset();
    renewGuest.mockReset();
    getLegalVersions.mockResolvedValue(LEGAL);
  });

  it('sin nombre y sin llave crea un invitado anónimo (no manda nombre)', async () => {
    createGuest.mockResolvedValue({
      access_token: 'jwt',
      expires_in: 900,
      contexto: {},
      invitado: { nombre: '', llave: 'L'.repeat(43) },
    });
    await guestSession('demo-a');
    expect(renewGuest).not.toHaveBeenCalled();
    expect(createGuest).toHaveBeenCalledWith({
      slug: 'demo-a',
      terminosVersion: 't-1',
      privacidadVersion: 'p-1',
    });
    expect(JSON.stringify(createGuest.mock.calls[0]?.[0] ?? {})).not.toContain('"nombre"');
    expect(readGuest()).toMatchObject({ llave: 'L'.repeat(43) });
  });

  it('sin nombre y con llave renueva la sesión en vez de dar de alta otra', async () => {
    localStorage.setItem('vaiinilla.buyer.guest.v1', JSON.stringify({ nombre: 'Lupi', llave: 'L'.repeat(43) }));
    renewGuest.mockResolvedValue({ access_token: 'jwt', expires_in: 900, contexto: {}, invitado: { nombre: 'Lupi' } });
    await guestSession('demo-a');
    expect(renewGuest).toHaveBeenCalledWith('demo-a', 'L'.repeat(43));
    expect(createGuest).not.toHaveBeenCalled();
  });

  it('sin nombre y con llave vencida de un invitado con nombre da de alta un anónimo (sin nombre)', async () => {
    localStorage.setItem('vaiinilla.buyer.guest.v1', JSON.stringify({ nombre: 'Lupi', llave: 'L'.repeat(43) }));
    renewGuest.mockRejectedValue(new Error('llave vencida'));
    createGuest.mockResolvedValue({
      access_token: 'jwt',
      expires_in: 900,
      contexto: {},
      invitado: { nombre: '', llave: 'K'.repeat(43) },
    });
    await guestSession('demo-a');
    expect(renewGuest).toHaveBeenCalledWith('demo-a', 'L'.repeat(43));
    expect(createGuest).toHaveBeenCalledWith({
      slug: 'demo-a',
      terminosVersion: 't-1',
      privacidadVersion: 'p-1',
    });
    expect(JSON.stringify(createGuest.mock.calls[0]?.[0] ?? {})).not.toContain('"nombre"');
  });

  it('con el mismo nombre renueva; con otro da de alta', async () => {
    localStorage.setItem('vaiinilla.buyer.guest.v1', JSON.stringify({ nombre: 'Lupi', llave: 'L'.repeat(43) }));
    renewGuest.mockResolvedValue({ access_token: 'jwt', expires_in: 900, contexto: {}, invitado: { nombre: 'Lupi' } });
    await guestSession('demo-a', 'Lupi');
    expect(renewGuest).toHaveBeenCalled();
    expect(createGuest).not.toHaveBeenCalled();

    renewGuest.mockClear();
    createGuest.mockResolvedValue({
      access_token: 'jwt2',
      expires_in: 900,
      contexto: {},
      invitado: { nombre: 'Ana', llave: 'K'.repeat(43) },
    });
    await guestSession('demo-a', 'Ana');
    expect(renewGuest).not.toHaveBeenCalled();
    expect(createGuest).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'demo-a', nombre: 'Ana' }),
    );
  });
});
