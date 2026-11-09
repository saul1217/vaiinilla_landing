import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { VaiinillaApiError } from './api-error';
import { guestSession } from './guest-session';
import { enterSpace, parseEntry } from './space-entry';
import { readSpace } from './space-session';

vi.mock('./api', () => ({ api: { resolveSpace: vi.fn() } }));
vi.mock('./guest-session', () => ({ guestSession: vi.fn(), forgetGuestEntry: vi.fn() }));

describe('entrar con un QR o NFC cuando hay límite', () => {
  beforeEach(() => {
    vi.spyOn(api, 'resolveSpace').mockResolvedValue({
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

describe('entrar con el QR de una habitación de hotel', () => {
  it('lleva al huésped a su estancia y guarda la habitación', async () => {
    vi.mocked(guestSession).mockResolvedValue({} as never);
    vi.spyOn(api, 'resolveSpace').mockResolvedValue({
      establecimiento_slug: 'hotel-sol',
      espacio_id: 12,
      espacio_nombre: 'Habitación 101',
      espacio_tipo: 'mesa',
      establecimiento_nombre: 'Hotel Sol',
      es_habitacion: true,
    });
    await expect(enterSpace('esp_puerta101')).resolves.toMatchObject({
      destination: '/e/hotel-sol/hotel',
      esHabitacion: true,
    });
    expect(readSpace('hotel-sol')).toMatchObject({ espacioId: 12, esHabitacion: true, qrToken: 'esp_puerta101' });
  });

  it('una mesa del restaurante del hotel sigue yendo al menú', async () => {
    vi.mocked(guestSession).mockResolvedValue({} as never);
    vi.spyOn(api, 'resolveSpace').mockResolvedValue({
      establecimiento_slug: 'hotel-sol',
      espacio_id: 3,
      espacio_nombre: 'Mesa 3',
      espacio_tipo: 'mesa',
      establecimiento_nombre: 'Hotel Sol',
    });
    await expect(enterSpace('esp_mesa3')).resolves.toMatchObject({ destination: '/e/hotel-sol', esHabitacion: false });
    expect(readSpace('hotel-sol')?.esHabitacion).toBeUndefined();
  });
});
