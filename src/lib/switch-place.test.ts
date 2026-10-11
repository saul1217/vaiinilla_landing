import { beforeEach, describe, expect, it } from 'vitest';
import { lastPlaceSlug, rememberPlace } from './last-place';
import { readSpace, rememberSpace, scannedSpace } from './space-session';
import { readTableParticipant, rememberTableParticipant } from './table-participant';
import { leavePlace } from './switch-place';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('cambiar tienda', () => {
  it('olvida la tienda, el espacio escaneado y la mesa', () => {
    rememberPlace('cafeteria-usagi');
    rememberSpace({ slug: 'cafeteria-usagi', espacioId: 7, nombre: 'Cancha 2', tipo: 'cancha', qrToken: '4000' });
    rememberTableParticipant({ slug: 'cafeteria-usagi', espacioId: 7, sesionId: 's1', participanteId: 'p1', alias: 'Ana' });

    leavePlace();

    expect(lastPlaceSlug()).toBeNull();
    expect(scannedSpace()).toBeNull();
    expect(readSpace('cafeteria-usagi')).toBeNull();
    expect(readTableParticipant()).toBeNull();
  });

  it('entrar de nuevo por código o QR vuelve a recordar la tienda elegida', () => {
    rememberPlace('cafeteria-usagi');
    leavePlace();
    rememberPlace('otra-tienda');
    rememberSpace({ slug: 'otra-tienda', espacioId: 1, nombre: 'Mesa 1' });
    expect(lastPlaceSlug()).toBe('otra-tienda');
    expect(scannedSpace()?.slug).toBe('otra-tienda');
  });
});
