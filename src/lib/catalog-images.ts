import type { CatalogProduct, OrderDetail } from '../types/api';

export function productImageUrl(imagenUrl: string | null | undefined): string | null {
  const url = imagenUrl?.trim();
  return url ? url : null;
}

function normalizeProductName(name: string | null | undefined): string {
  return (name ?? '').trim().toLocaleLowerCase('es');
}

export function catalogImageMap(products: CatalogProduct[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const product of products) {
    const url = productImageUrl(product.imagen_url);
    if (url) map.set(product.id, url);
  }
  return map;
}

export function peekCatalogProducts(products: CatalogProduct[], limit = 4): CatalogProduct[] {
  const available = products.filter((item) => item.disponible);
  return [...available]
    .sort((left, right) => {
      const leftPhoto = productImageUrl(left.imagen_url) ? 0 : 1;
      const rightPhoto = productImageUrl(right.imagen_url) ? 0 : 1;
      return leftPhoto - rightPhoto;
    })
    .slice(0, limit);
}

export function leftoverPeekProducts(
  products: CatalogProduct[],
  cartProductIds: Iterable<number>,
  limit = 4,
): CatalogProduct[] {
  const inCart = new Set(cartProductIds);
  return peekCatalogProducts(
    products.filter((item) => !inCart.has(item.id)),
    limit,
  );
}

export function orderThumbUrl(
  order: OrderDetail,
  images: Map<number, string>,
  products: CatalogProduct[] = [],
): string | null {
  // La foto que manda el pedido gana: no depende de que el catálogo ya haya cargado.
  for (const item of order.items ?? []) {
    const own = productImageUrl(item.imagen_url);
    if (own) return own;
  }
  // Una renta de cancha: su producto no tiene foto, la cancha sí.
  const court = productImageUrl(order.reserva?.espacio?.imagen_url ?? null);
  if (court) return court;
  for (const item of order.items ?? []) {
    const byId = images.get(item.producto_id);
    if (byId) return byId;
  }
  if (products.length === 0) return null;
  const byName = new Map<string, string>();
  for (const product of products) {
    const url = productImageUrl(product.imagen_url);
    const name = normalizeProductName(product.nombre);
    if (url && name && !byName.has(name)) byName.set(name, url);
  }
  for (const item of order.items ?? []) {
    const byItemName = byName.get(normalizeProductName(item.nombre_producto));
    if (byItemName) return byItemName;
  }
  return null;
}
