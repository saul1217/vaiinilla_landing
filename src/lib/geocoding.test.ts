import { describe, expect, it, vi } from 'vitest';
import { formatNominatimAddress, pointFromText, reverseAddress, searchAddress } from './geocoding';

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) } as Response);
}

describe('pointFromText', () => {
  it('lee coordenadas sueltas y enlaces de Google Maps', () => {
    expect(pointFromText('28.6321, -106.0889')).toEqual({ lat: 28.6321, lng: -106.0889 });
    expect(pointFromText('https://www.google.com/maps/place/X/@28.6321,-106.0889,17z')).toEqual({ lat: 28.6321, lng: -106.0889 });
    expect(pointFromText('https://maps.google.com/?q=28.6321,-106.0889')).toEqual({ lat: 28.6321, lng: -106.0889 });
    expect(pointFromText('https://www.google.com/maps/place/X/data=!3d28.6321!4d-106.0889')).toEqual({ lat: 28.6321, lng: -106.0889 });
  });

  it('una dirección escrita o un punto imposible no son coordenadas', () => {
    expect(pointFromText('Aldama 1408, Centro')).toBeNull();
    expect(pointFromText('95, 10')).toBeNull();
  });
});

describe('Nominatim', () => {
  it('arma la dirección con la calle y el número primero', () => {
    expect(
      formatNominatimAddress({ road: 'Calle Aldama', house_number: '1408', suburb: 'Centro', postcode: '31000', city: 'Chihuahua' }),
    ).toBe('Calle Aldama 1408, Centro, 31000, Chihuahua');
    expect(formatNominatimAddress({ suburb: 'Centro' })).toBe('Centro');
    expect(formatNominatimAddress({})).toBeNull();
  });

  it('busca en México y devuelve el primer punto', async () => {
    const fetcher = vi.fn(() => jsonResponse([{ lat: '28.63', lon: '-106.08' }]));
    await expect(searchAddress('Aldama 1408 Chihuahua', fetcher as unknown as typeof fetch)).resolves.toEqual({ lat: 28.63, lng: -106.08 });
    const url = String((fetcher.mock.calls[0] as unknown[])[0]);
    expect(url).toContain('nominatim.openstreetmap.org/search');
    expect(url).toContain('countrycodes=mx');
  });

  it('un enlace con coordenadas no consulta a nadie', async () => {
    const fetcher = vi.fn();
    await expect(searchAddress('28.63, -106.08', fetcher as unknown as typeof fetch)).resolves.toEqual({ lat: 28.63, lng: -106.08 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('sin resultados devuelve null; si falla la calle, null (el carrito pone las coordenadas)', async () => {
    await expect(searchAddress('xyz', () => jsonResponse([]))).resolves.toBeNull();
    await expect(reverseAddress({ lat: 1, lng: 2 }, () => jsonResponse({}, false))).resolves.toBeNull();
    await expect(
      reverseAddress({ lat: 1, lng: 2 }, () => jsonResponse({ address: { road: 'Roble', house_number: '5' } })),
    ).resolves.toBe('Roble 5');
  });
});
