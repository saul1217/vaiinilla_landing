// Memoria de datos compartida por todas las pestañas del dock (Menú, Pedidos, Cartera,
// Carrito). Al volver a una pestaña se muestra al instante lo último que se cargó y se
// actualiza en segundo plano. Las peticiones iguales en curso se comparten.
type Entry = { data: unknown; at: number };

/** Claves de lo que comparten las pestañas. Lo de una cuenta lleva su uid. */
export const resourceKeys = {
  establishment: (slug: string) => `negocio:${slug}`,
  catalog: (slug: string) => `catalogo:${slug}`,
  orders: (uid: string, slug: string) => `pedidos:${uid}:${slug}`,
  wallet: (uid: string, slug: string) => `saldo:${uid}:${slug}`,
};

const entries = new Map<string, Entry>();
const inFlight = new Map<string, Promise<unknown>>();

/** Lo último que se guardó con esta clave, sin pedir nada al servidor. */
export function peekResource<T>(key: string): T | undefined {
  return entries.get(key)?.data as T | undefined;
}

export function storeResource<T>(key: string, data: T): void {
  entries.set(key, { data, at: Date.now() });
}

/**
 * Devuelve el dato guardado si tiene menos de `maxAgeMs`; si no, lo pide (una sola
 * petición aunque varias pantallas lo pidan a la vez) y lo guarda.
 */
export function cachedResource<T>(key: string, maxAgeMs: number, load: () => Promise<T>): Promise<T> {
  const entry = entries.get(key);
  if (entry && Date.now() - entry.at < maxAgeMs) return Promise.resolve(entry.data as T);
  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;
  const request = load()
    .then((data) => {
      storeResource(key, data);
      return data;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}

/** Al cerrar sesión, y entre pruebas: no queda nada de la cuenta anterior. */
export function clearResourceCache(): void {
  entries.clear();
  inFlight.clear();
}
