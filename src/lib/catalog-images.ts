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

export function orderThumbUrl(
  order: OrderDetail,
  images: Map<number, string>,
  products: CatalogProduct[] = [],
): string | null {
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
