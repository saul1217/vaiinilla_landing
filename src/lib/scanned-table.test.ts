import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readCart, writeCart } from './cart-storage';
import { readGuestOrders, rememberGuestOrder } from './guest-orders';
import { readSpace, rememberSpace } from './space-session';
import { currentScannedTable } from './scanned-table';
import { readTableParticipant, rememberTableParticipant } from './table-participant';

const apiMock = vi.hoisted(() => ({ currentTable: vi.fn() }));

vi.mock('./api', () => ({ api: apiMock }));

const space = { slug: 'demo', espacioId: 67, nombre: 'Mesa 67', tipo: 'mesa', sesionId: 'session-a' };

describe('mesa escaneada según backend', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    apiMock.currentTable.mockReset();
  });

  it('limpia el contexto local de la sesión al confirmar que backend ya no tiene mesa activa', async () => {
    rememberSpace({ ...space, qrToken: 'qr' });
    rememberTableParticipant({ ...space, participanteId: 'participant-a', alias: 'Kikin' });
    writeCart({ slug: space.slug, establishmentName: 'Demo', sessionId: space.sesionId, spaceId: space.espacioId, lines: [] });
    rememberGuestOrder({ token: 'tracking-a', slug: space.slug, folio: 1, placeName: 'Demo', createdAt: Date.now(), destination: 'en_espacio', sessionId: space.sesionId });
    apiMock.currentTable.mockResolvedValue(null);

    await expect(currentScannedTable('token', space)).resolves.toBeNull();

    expect(readTableParticipant()).toBeNull();
    expect(readCart()).toBeNull();
    expect(readSpace(space.slug)).toBeNull();
    expect(readGuestOrders()).toEqual([]);
  });
});
