import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGuestLiveOrders } from './use-guest-live-orders';

const authState = vi.hoisted(() => ({ ready: false }));
const listGuestOrders = vi.hoisted(() => vi.fn());

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: null, ready: authState.ready }),
}));
vi.mock('./api', () => ({ api: { listGuestOrders: (...args: unknown[]) => listGuestOrders(...args) as Promise<unknown> } }));

describe('useGuestLiveOrders', () => {
  beforeEach(() => {
    authState.ready = false;
    listGuestOrders.mockReset();
    listGuestOrders.mockResolvedValue([]);
  });

  it('mientras la sesión no está lista sigue cargando: no salta el estado vacío', () => {
    const { result } = renderHook(() => useGuestLiveOrders('demo'));
    expect(result.current.loading).toBe(true);
    expect(listGuestOrders).not.toHaveBeenCalled();
  });
});
