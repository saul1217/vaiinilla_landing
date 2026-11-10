/** Reversible feature switches for buyer-facing product areas. */
export const SHOW_WALLET = false;

/** Una bandera de Vite solo se prende con el texto `true`; cualquier otra cosa (o nada) la deja apagada. */
export function parseFeatureFlag(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

/**
 * Modo papás: el tutor ve el saldo, los movimientos y lo que pidió cada hijo (como en Android).
 * Apagado por defecto; se prende por ambiente con `VITE_FEATURE_MODO_PAPAS=true`.
 */
export const SHOW_PARENT_MODE = parseFeatureFlag(import.meta.env.VITE_FEATURE_MODO_PAPAS);
