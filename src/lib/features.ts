/** Una bandera de Vite solo se prende con el texto `true`; cualquier otra cosa (o nada) la deja apagada. */
export function parseFeatureFlag(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

/**
 * Cartera del cliente: «Mi saldo» en la barra y recargar (en Caja con el QR o con tarjeta de prueba),
 * como en Android. Apagada por defecto; se prende por ambiente con `VITE_FEATURE_CARTERA=true`.
 */
export const SHOW_WALLET_RELOAD = parseFeatureFlag(import.meta.env.VITE_FEATURE_CARTERA);

/** Reversible feature switches for buyer-facing product areas. Con la cartera apagada, «Mi saldo» no sale. */
export const SHOW_WALLET = SHOW_WALLET_RELOAD;

/**
 * Pedido a domicilio con mapa (paridad con Android). Apagado por defecto: se enciende por ambiente
 * con VITE_FEATURE_DOMICILIO=true. Aun encendido, solo aparece en negocios con reparto activo.
 */
export function isHomeDeliveryEnabled(value: string | undefined = import.meta.env.VITE_FEATURE_DOMICILIO): boolean {
  return value?.trim() === 'true';
}

/**
 * Modo papás: el tutor ve el saldo, los movimientos y lo que pidió cada hijo (como en Android).
 * Apagado por defecto; se prende por ambiente con `VITE_FEATURE_MODO_PAPAS=true`.
 */
export const SHOW_PARENT_MODE = parseFeatureFlag(import.meta.env.VITE_FEATURE_MODO_PAPAS);
