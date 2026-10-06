import type { CatalogCategory, CatalogProduct } from '../types/api';

/**
 * Orden preferido en la vista "Todo" del menú de alumno:
 * COMIDA / SNACKS (100) → BEBIDAS (200) → POSTRES (300) → Otros (400).
 */
export function categoryRank(nombre?: string | null, defaultOrder = 0): number {
  if (!nombre) return 500 + defaultOrder;
  const n = nombre.trim().toLowerCase();
  if (/comida|alimento|plato|platillo|snack|taco|lonche|torta|hamburguesa|sandwich|sándwich|pizza|desayuno/i.test(n)) {
    return 100 + defaultOrder;
  }
  if (/bebida|cafe|café|refresco|jugo|agua|drink|cerveza|coctel|cóctel/i.test(n)) {
    return 200 + defaultOrder;
  }
  if (/postre|dulce|helado|pan|galleta|pastel|reposteria|repostería/i.test(n)) {
    return 300 + defaultOrder;
  }
  return 400 + defaultOrder;
}

export function sortProductsForTodo(
  products: CatalogProduct[],
  categories: CatalogCategory[],
): CatalogProduct[] {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  return products.slice().sort((a, b) => {
    const catA = catMap.get(a.categoria_id);
    const catB = catMap.get(b.categoria_id);
    const rankA = categoryRank(catA?.nombre, catA?.orden ?? 0);
    const rankB = categoryRank(catB?.nombre, catB?.orden ?? 0);
    if (rankA !== rankB) return rankA - rankB;
    return a.id - b.id;
  });
}
