// Poner en el carrito el pedido que propone el asistente, como Android
// (OrderFlowViewModel.addAssistantLines): primero se quita lo que puso el pedido anterior
// del asistente (cada propuesta reemplaza a la anterior) y luego se agrega la nueva. Lo que
// pide elegir opciones, está agotado o ya no está en el menú no se agrega y se nombra.
import { cartLineKey, defaultOptionIds, validateSelections } from './cart';
import type { AssistantOrderLine } from './customer-assistant';
import type { CartLine, CatalogProduct } from '../types/api';

export const MAX_LINE_QUANTITY = 20;

export interface AssistantCartPlan {
  /** Cantidades nuevas de líneas que ya estaban (0 = se quita). */
  updates: { productId: number; optionIds: number[]; notes?: string; quantity: number }[];
  adds: { product: CatalogProduct; optionIds: number[]; quantity: number; notes?: string }[];
  /** Nombres de lo que no se agregó. */
  skipped: string[];
}

/**
 * El producto se agrega sin abrir su ficha: está disponible y no tiene opciones que el
 * cliente deba escoger (nunca se escoge por él, ni la primera de una lista obligatoria).
 */
export function canQuickAdd(product: CatalogProduct | undefined): product is CatalogProduct {
  if (!product || !product.disponible) return false;
  if (product.grupos_opcion.some((group) => group.min_selecciones > 0)) return false;
  return validateSelections(product, defaultOptionIds(product)) === null;
}

const noteOf = (line: AssistantOrderLine) => line.note?.trim() || undefined;

export function planAssistantOrder(input: {
  cartLines: CartLine[];
  products: CatalogProduct[];
  lines: AssistantOrderLine[];
  replacing: AssistantOrderLine[];
}): AssistantCartPlan {
  const byId = new Map(input.products.map((product) => [product.id, product]));
  // Cantidades de trabajo por línea del carrito.
  const quantities = new Map<string, { productId: number; optionIds: number[]; notes?: string; quantity: number; original: number }>();
  for (const line of input.cartLines) {
    quantities.set(cartLineKey(line.productId, line.optionIds, line.notes ?? ''), {
      productId: line.productId,
      optionIds: line.optionIds,
      notes: line.notes,
      quantity: line.quantity,
      original: line.quantity,
    });
  }

  for (const old of input.replacing) {
    const product = byId.get(old.product.productId);
    if (!product) continue;
    const key = cartLineKey(product.id, defaultOptionIds(product), noteOf(old) ?? '');
    const current = quantities.get(key);
    if (current) current.quantity = Math.max(0, current.quantity - old.quantity);
  }

  const adds: AssistantCartPlan['adds'] = [];
  const skipped: string[] = [];
  for (const line of input.lines) {
    const product = byId.get(line.product.productId);
    if (line.product.needsOptions || !canQuickAdd(product)) {
      skipped.push(line.product.name || product?.nombre || 'un producto');
      continue;
    }
    const optionIds = defaultOptionIds(product);
    const notes = noteOf(line);
    const key = cartLineKey(product.id, optionIds, notes ?? '');
    const current = quantities.get(key);
    const quantity = Math.min(MAX_LINE_QUANTITY, Math.max(1, line.quantity));
    if (current) {
      if (current.quantity + quantity > MAX_LINE_QUANTITY) {
        skipped.push(line.product.name || product.nombre);
        continue;
      }
      current.quantity += quantity;
    } else {
      // Otra línea igual en la misma propuesta se suma a la que ya va.
      const pending = adds.find((add) => cartLineKey(add.product.id, add.optionIds, add.notes ?? '') === key);
      if (pending) {
        if (pending.quantity + quantity > MAX_LINE_QUANTITY) {
          skipped.push(line.product.name || product.nombre);
          continue;
        }
        pending.quantity += quantity;
      } else {
        adds.push({ product, optionIds, quantity, notes });
      }
    }
  }

  const updates = [...quantities.values()]
    .filter((entry) => entry.quantity !== entry.original)
    .map(({ productId, optionIds, notes, quantity }) => ({ productId, optionIds, notes, quantity }));
  return { updates, adds, skipped };
}
