// Tienda de CI de develop. Las pruebas de e2e/ solo leen datos de aquí, nunca de tiendas reales.
// Se pueden redirigir con E2E_PLACE_SLUG y E2E_PLACE_NAME si el seed cambia de nombre.
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const CI_SLUG = process.env.E2E_PLACE_SLUG ?? 'ci-vaiinilla';
export const CI_PLACE_NAME = process.env.E2E_PLACE_NAME ?? 'ci-vaiinilla';
export const CI_PLACE_NAME_RE = new RegExp(escape(CI_PLACE_NAME).replace(/-/g, '[-\\s]'), 'i');
export const CI_MENU_URL = `/e/${CI_SLUG}`;
export const CI_CART_URL_RE = new RegExp(`/e/${escape(CI_SLUG)}/carrito$`);
