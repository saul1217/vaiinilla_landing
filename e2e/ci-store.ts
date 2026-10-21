import type { APIRequestContext } from '@playwright/test';

// Tienda de CI de develop. Las pruebas de e2e/ solo leen datos de aquí, nunca de tiendas reales.
// Se pueden redirigir con E2E_PLACE_SLUG y E2E_PLACE_NAME si el seed cambia de nombre.
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const CI_SLUG = process.env.E2E_PLACE_SLUG ?? 'ci-vaiinilla';
export const CI_PLACE_NAME = process.env.E2E_PLACE_NAME ?? 'ci-vaiinilla';
export const CI_PLACE_NAME_RE = new RegExp(escape(CI_PLACE_NAME).replace(/-/g, '[-\\s]'), 'i');
export const CI_MENU_URL = `/e/${CI_SLUG}`;
export const CI_CART_URL_RE = new RegExp(`/e/${escape(CI_SLUG)}/carrito$`);

/**
 * Precondición de datos/entorno: la tienda de CI debe existir y estar listada en el backend de
 * develop. Si no, falla de inmediato con el estado HTTP real en lugar de agotar 20 s buscando un
 * radio que nunca llega (distingue backend inalcanzable, tienda no sembrada y tienda no pública).
 */
export async function assertCiStoreSeeded(request: APIRequestContext): Promise<void> {
  const detail = await request
    .get(`/api/v1/publico/establecimientos/${CI_SLUG}`, { timeout: 15_000 })
    .catch((error: Error) => error);
  if (detail instanceof Error) {
    throw new Error(`[datos/entorno] el backend de develop no responde vía el proxy /api: ${detail.message}`);
  }
  if (!detail.ok()) {
    throw new Error(
      `[datos/entorno] GET /publico/establecimientos/${CI_SLUG} respondió ${detail.status()}: la tienda de CI no está sembrada o no es pública. ${(await detail.text()).slice(0, 200)}`,
    );
  }
  const list = await request.get(
    `/api/v1/publico/establecimientos?query=${encodeURIComponent(CI_PLACE_NAME)}&limit=10`,
    { timeout: 15_000 },
  );
  const body = await list.text();
  if (!list.ok() || !body.toLowerCase().includes(CI_SLUG.toLowerCase())) {
    throw new Error(
      `[datos/entorno] ${CI_SLUG} existe pero el listado público (${list.status()}) no la devuelve al buscar «${CI_PLACE_NAME}»: no aparece en discovery. ${body.slice(0, 200)}`,
    );
  }
}
