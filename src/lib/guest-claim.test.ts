import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';
import type { ClaimGuestOrdersResponse } from '../types/api';

const { claimGuestOrders: apiClaim, firebaseIdToken } = vi.hoisted(() => ({
  claimGuestOrders: vi.fn(),
  firebaseIdToken: vi.fn(),
}));

vi.mock('./api', () => ({
  api: {
    claimGuestOrders: (...args: unknown[]) => apiClaim(...args) as Promise<unknown>,
  },
}));

vi.mock('./firebase', () => ({
  firebaseIdToken: (...args: unknown[]) => firebaseIdToken(...args) as Promise<unknown>,
}));

import { claimGuestOrders, hasClaimableGuestOrders } from './guest-claim';
import { rememberGuestOrder } from './guest-orders';

const user = { uid: 'firebase-1' } as User;
const out: ClaimGuestOrdersResponse = {
  reclamado: { pedidos: 2, establecimientos: ['padel'], mesa_transferida: true, mesa_ocupada: false },
  invitado: { nombre: 'Ana' },
};

function seedGuest() {
  localStorage.setItem(
    'vaiinilla.buyer.guest.v1',
    JSON.stringify({ nombre: 'Ana', llave: 'k'.repeat(43) }),
  );
  rememberGuestOrder({ token: 't1', slug: 'padel', folio: 7, placeName: 'Pádel', createdAt: Date.now() });
}

describe('reclamo invitado → cuenta', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    firebaseIdToken.mockResolvedValue('tok');
  });

  it('sin llave no hay nada que reclamar (ni siquiera llama)', async () => {
    expect(hasClaimableGuestOrders()).toBe(false);
    await expect(claimGuestOrders(user)).resolves.toBeNull();
    expect(apiClaim).not.toHaveBeenCalled();
  });

  it('con llave reclama, olvida la llave y poda los enlaces de esos negocios', async () => {
    seedGuest();
    expect(hasClaimableGuestOrders()).toBe(true);
    apiClaim.mockResolvedValue(out);

    await expect(claimGuestOrders(user)).resolves.toEqual(out);
    expect(apiClaim).toHaveBeenCalledWith('tok', 'k'.repeat(43));
    expect(localStorage.getItem('vaiinilla.buyer.guest.v1')).toBeNull();
    expect(hasClaimableGuestOrders()).toBe(false);
  });

  it('si la llave ya no sirve, el error sube (la UI la olvida)', async () => {
    seedGuest();
    const cause = Object.assign(new Error('ya no válida'), { code: 'GUEST_KEY_INVALID' });
    apiClaim.mockRejectedValue(cause);
    await expect(claimGuestOrders(user)).rejects.toBe(cause);
    expect(localStorage.getItem('vaiinilla.buyer.guest.v1')).not.toBeNull();
  });
});
