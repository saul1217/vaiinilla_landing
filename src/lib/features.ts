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
