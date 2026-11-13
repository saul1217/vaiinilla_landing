// Buscar una dirección y saber la calle de un punto del mapa. Android usa el Geocoder del teléfono;
// en la web se usa Nominatim de OpenStreetMap (los mismos mapas de los mosaicos). Su política pide
// pocas consultas: se busca solo al enviar el texto y la calle se pide cuando el mapa se detiene.
const NOMINATIM = 'https://nominatim.openstreetmap.org';

export interface GeoPoint {
  lat: number;
  lng: number;
}

function validPoint(lat: number, lng: number): GeoPoint | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/**
 * Coordenadas escritas o pegadas: "28.63, -106.08" o un enlace de Google Maps con `@lat,lng`,
 * `q=lat,lng` o `!3dlat!4dlng`. Null si el texto no trae un punto.
 */
export function pointFromText(text: string): GeoPoint | null {
  const value = text.trim();
  const patterns = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|ll|center)=(-?\d+(?:\.\d+)?)(?:,|%2C)\s*(-?\d+(?:\.\d+)?)/i,
    /^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) {
      const point = validPoint(Number(match[1]), Number(match[2]));
      if (point) return point;
    }
  }
  return null;
}

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  house_number?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
}

/** "Aldama 1408, Centro, 31000, Chihuahua": calle con número primero, como lo espera el carrito. */
export function formatNominatimAddress(address: NominatimAddress | undefined): string | null {
  if (!address) return null;
  const road = address.road ?? address.pedestrian;
  const street = road ? [road, address.house_number].filter(Boolean).join(' ') : null;
  const area = address.neighbourhood ?? address.suburb ?? address.quarter;
  const city = address.city ?? address.town ?? address.village ?? address.municipality;
  const parts = [street, area, address.postcode, city].filter((part): part is string => Boolean(part?.trim()));
  return parts.length ? parts.join(', ') : null;
}

async function getJson(url: string, fetcher: typeof fetch): Promise<unknown> {
  const response = await fetcher(url, { headers: { Accept: 'application/json', 'Accept-Language': 'es' } });
  if (!response.ok) throw new Error(`geocoding ${response.status}`);
  return response.json();
}

/** El punto de una dirección escrita (o de unas coordenadas pegadas); null si no se encuentra. */
export async function searchAddress(text: string, fetcher: typeof fetch = fetch): Promise<GeoPoint | null> {
  const pasted = pointFromText(text);
  if (pasted) return pasted;
  const query = text.trim();
  if (!query) return null;
  const params = new URLSearchParams({ format: 'jsonv2', limit: '1', countrycodes: 'mx', q: query });
  const results = await getJson(`${NOMINATIM}/search?${params}`, fetcher);
  if (!Array.isArray(results) || results.length === 0) return null;
  const first = results[0] as { lat?: string; lon?: string };
  return validPoint(Number(first.lat), Number(first.lon));
}

/** La dirección de un punto; null si no hay o falla (el carrito pone las coordenadas). */
export async function reverseAddress(point: GeoPoint, fetcher: typeof fetch = fetch): Promise<string | null> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(point.lat),
    lon: String(point.lng),
    zoom: '18',
    addressdetails: '1',
  });
  try {
    const result = (await getJson(`${NOMINATIM}/reverse?${params}`, fetcher)) as { address?: NominatimAddress };
    return formatNominatimAddress(result?.address);
  } catch {
    return null;
  }
}
