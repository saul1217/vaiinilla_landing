/** Reversible feature switches for buyer-facing product areas. */
export const SHOW_WALLET = false;

/**
 * Pedido a domicilio con mapa (paridad con Android). Apagado por defecto: se enciende por ambiente
 * con VITE_FEATURE_DOMICILIO=true. Aun encendido, solo aparece en negocios con reparto activo.
 */
export function isHomeDeliveryEnabled(value: string | undefined = import.meta.env.VITE_FEATURE_DOMICILIO): boolean {
  return value?.trim() === 'true';
}
