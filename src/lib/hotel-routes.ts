// Rutas del huésped de hotel dentro del negocio: `/e/<negocio>/hotel/...`.
export type HotelView = 'codigo' | 'solicitudes' | 'cuenta' | 'pedido';

export function hotelPath(slug: string, view?: HotelView): string {
  const base = `/e/${slug}/hotel`;
  return view ? `${base}/${view}` : base;
}
