// Rutas del huésped de hotel dentro del negocio: `/e/<negocio>/hotel/...`.
export type HotelView = 'codigo' | 'solicitudes' | 'cuenta' | 'pedido';

/**
 * Flujo del huésped de hotel: apagado por defecto. Se prende por ambiente con
 * `VITE_FEATURE_HOTEL=true`; cualquier otro valor (o nada) lo deja apagado. Apagado, las
 * rutas `/hotel` no existen y el QR de una habitación se trata como cualquier otro espacio.
 * Se lee en cada llamada para que las pruebas puedan prenderlo con `vi.stubEnv`.
 */
export function isHotelGuestEnabled(value: string | undefined = import.meta.env.VITE_FEATURE_HOTEL): boolean {
  return value?.trim().toLowerCase() === 'true';
}

export function hotelPath(slug: string, view?: HotelView): string {
  const base = `/e/${slug}/hotel`;
  return view ? `${base}/${view}` : base;
}
