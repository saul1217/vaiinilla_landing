import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { VaiinillaApiError } from './api-error';
import { guestSession } from './guest-session';
import { enterSpace, parseEntry } from './space-entry';

vi.mock('./api', () => ({ api: { resolveSpace: vi.fn() } }));
vi.mock('./guest-session', () => ({ guestSession: vi.fn(), forgetGuestEntry: vi.fn() }));

describe('entrar con un QR o NFC cuando hay límite', () => {
  beforeEach(() => {
    vi.mocked(api.resolveSpace).mockResolvedValue({
      establecimiento_slug: 'padel',
      espacio_id: 's1',
      espacio_nombre: 'Cancha 1',
      espacio_tipo: 'cancha',
    } as never);
  });

  it('un 429 al abrir la sesión de invitado se avisa para esperar y reintentar', async () => {
    vi.mocked(guestSession).mockRejectedValue(new VaiinillaApiError(429, { code: 'RATE_LIMITED', message: 'x' }));
    await expect(enterSpace('esp_abc')).rejects.toThrow(/espera un momento y vuelve a intentar/i);
  });

  it('otro fallo de la sesión no bloquea la entrada', async () => {
    vi.mocked(guestSession).mockRejectedValue(new VaiinillaApiError(500, { code: 'X', message: 'x' }));
    await expect(enterSpace('esp_abc')).resolves.toMatchObject({ destination: '/e/padel' });
  });
});

describe('lo que se lee en un QR, una etiqueta NFC o el teclado', () => {
  it('el enlace de una mesa da su token (con o sin /e)', () => {
    expect(parseEntry('https://vaiinilla.app/renasci-bar/m/esp_abc')).toEqual({ kind: 'space', token: 'esp_abc' });
    expect(parseEntry('https://www.vaiinilla.app/e/renasci-bar/m/esp_abc')).toEqual({ kind: 'space', token: 'esp_abc' });
  });

  it('el QR general de la tienda abre su menú', () => {
    expect(parseEntry('https://vaiinilla.app/e/renasci-bar')).toEqual({ kind: 'store', slug: 'renasci-bar' });
  });

  it('un código de 4 dígitos es una mesa', () => {
    expect(parseEntry(' 1736 ')).toEqual({ kind: 'space', token: '1736' });
  });

  it('lo que no es de Vaiinilla se rechaza', () => {
    expect(parseEntry('https://otro-sitio.com/renasci-bar/m/esp_abc')).toBeNull();
    expect(parseEntry('hola')).toBeNull();
    expect(parseEntry('123')).toBeNull();
    expect(parseEntry('https://vaiinilla.app/pedir')).toBeNull();
  });
});
