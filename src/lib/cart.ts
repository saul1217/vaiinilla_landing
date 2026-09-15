import type { CartLine, CatalogProduct, CreateOrderInput } from '../types/api';
import { cartPreview, linePreview, productUnitPreview } from './money';

export function optionExtraPrices(product: CatalogProduct, optionIds: number[]): string[] {
  return product.grupos_opcion
    .flatMap((group) => group.opciones)
    .filter((option) => optionIds.includes(option.id))
    .map((option) => option.precio_extra);
}

export function validateSelections(product: CatalogProduct, optionIds: number[]): string | null {
  const allIds = new Set(
    product.grupos_opcion.flatMap((group) => group.opciones.map((option) => option.id)),
  );
  if (optionIds.some((id) => !allIds.has(id))) {
    return 'Hay una opción que no pertenece a este producto.';
  }
  if (new Set(optionIds).size !== optionIds.length) {
    return 'No se pueden repetir opciones.';
  }
  for (const group of product.grupos_opcion) {
    const count = group.opciones.filter((option) => optionIds.includes(option.id)).length;
    if (count < group.min_selecciones || count > group.max_selecciones) {
      return `${group.nombre}: elige entre ${group.min_selecciones} y ${group.max_selecciones}.`;
    }
  }
  return null;
}

export function defaultOptionIds(product: CatalogProduct): number[] {
  const selected: number[] = [];
  for (const group of product.grupos_opcion) {
    if (group.min_selecciones === 1 && group.max_selecciones === 1 && group.opciones[0]) {
      selected.push(group.opciones[0].id);
    }
  }
  return selected;
}

export function cartLineKey(productId: number, optionIds: number[]): string {
  return `${productId}:${[...optionIds].sort((a, b) => a - b).join(',')}`;
}

export function previewForProduct(product: CatalogProduct, optionIds: number[], quantity: number) {
  const unit = productUnitPreview(product.precio_digital, optionExtraPrices(product, optionIds));
  if (!unit) return null;
  const line = linePreview(unit, quantity);
  if (!line) return null;
  return { unit, line };
}

export function cartTotal(lines: CartLine[]): string | null {
  const totals: string[] = [];
  for (const line of lines) {
    const total = linePreview(line.unitPreview, line.quantity);
    if (!total) return null;
    totals.push(total);
  }
  return cartPreview(totals);
}

export function toCreateOrderInput(
  lines: CartLine[],
  paymentMethod: 'efectivo' | 'saldo',
  kitchenNotes: string,
): CreateOrderInput {
  if (lines.length < 1 || lines.length > 50) {
    throw new Error('El pedido debe contener entre 1 y 50 líneas.');
  }
  return {
    metodo_pago: paymentMethod,
    destino: 'para_llevar',
    espacio_id: null,
    notas_cocina: kitchenNotes.trim() || null,
    items: lines.map((line) => {
      if (line.quantity < 1 || line.quantity > 20) {
        throw new Error('Cada producto admite entre 1 y 20 piezas.');
      }
      return {
        producto_id: line.productId,
        cantidad: line.quantity,
        opcion_ids: [...line.optionIds].sort((a, b) => a - b),
      };
    }),
  };
}

export function isOperationallyReady(status: {
  recibiendo_pedidos: boolean;
  sesion_caja_abierta: boolean;
  caja_en_linea: boolean;
  cocina_en_linea: boolean;
} | null): boolean {
  if (!status) return false;
  return (
    status.recibiendo_pedidos &&
    status.sesion_caja_abierta &&
    status.caja_en_linea &&
    status.cocina_en_linea
  );
}
