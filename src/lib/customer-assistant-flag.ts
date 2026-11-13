// Bandera del asistente de pedidos del cliente («Pregúntame qué pedir»). Apagada por
// defecto: solo se prende con VITE_FEATURE_ASISTENTE_CLIENTE=true en el ambiente
// (Vercel o .env local). Apagada, la ruta /e/<negocio>/asistente no existe y el menú no
// enseña la entrada. Es reversible sin tocar código.

/** Solo el texto exacto `true` (sin importar mayúsculas ni espacios) la prende. */
export function parseFeatureFlag(value: string | undefined | null): boolean {
  return value?.trim().toLowerCase() === 'true';
}

export const CUSTOMER_ASSISTANT_ENABLED: boolean = parseFeatureFlag(
  import.meta.env.VITE_FEATURE_ASISTENTE_CLIENTE,
);

/**
 * La entrada sale con la bandera prendida y si la tienda tiene el asistente para clientes.
 * `asistente_clientes` ausente (backend anterior) cuenta como sí, igual que en Android.
 */
export function showsCustomerAssistant(
  place: { asistente_clientes?: boolean } | null | undefined,
  enabled: boolean = CUSTOMER_ASSISTANT_ENABLED,
): boolean {
  return enabled && Boolean(place) && place?.asistente_clientes !== false;
}

export function assistantPath(slug: string): string {
  return `/e/${slug}/asistente`;
}
