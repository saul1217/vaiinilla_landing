import { describe, expect, it } from 'vitest';
import { canQuickAdd, planAssistantOrder } from './assistant-cart';
import type { AssistantOrderLine } from './customer-assistant';
import type { CartLine, CatalogProduct } from '../types/api';

function product(id: number, extra: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id,
    categoria_id: 1,
    estacion_preparacion: 'cocina',
    nombre: `P${id}`,
    descripcion: null,
    ingredientes: null,
    alergenos: null,
    tiempo_estimado_min: 5,
    precio_mostrador: '50.00',
    precio_digital: '48.00',
    disponible: true,
    imagen_url: null,
    grupos_opcion: [],
    ...extra,
  };
}

const withRequiredOptions = product(3, {
  grupos_opcion: [
    { id: 1, nombre: 'Salsa', min_selecciones: 1, max_selecciones: 1, opciones: [{ id: 5, nombre: 'Verde', precio_extra: '0.00' }] },
  ] as unknown as CatalogProduct['grupos_opcion'],
});

function line(productId: number, quantity: number, note: string | null = null, needsOptions = false): AssistantOrderLine {
  return {
    product: { productId, name: `P${productId}`, price: '48.00', imageUrl: null, available: true, needsOptions, minutes: null },
    quantity,
    note,
  };
}

function cartLine(productId: number, quantity: number, notes?: string): CartLine {
  return { productId, quantity, optionIds: [], productName: `P${productId}`, notes, unitPreview: '48.00', imageUrl: null };
}

const products = [product(1), product(2), product(4, { disponible: false }), withRequiredOptions];

describe('planAssistantOrder', () => {
  it('agrega las líneas que se pueden y nombra las que no', () => {
    const plan = planAssistantOrder({
      cartLines: [],
      products,
      lines: [line(1, 2, 'sin cebolla'), line(4, 1), line(3, 1), line(9, 1), line(2, 1, null, true)],
      replacing: [],
    });
    expect(plan.adds).toEqual([{ product: products[0], optionIds: [], quantity: 2, notes: 'sin cebolla' }]);
    expect(plan.skipped).toEqual(['P4', 'P3', 'P9', 'P2']);
    expect(plan.updates).toEqual([]);
  });

  it('el pedido nuevo reemplaza lo que puso el anterior sin tocar lo agregado a mano', () => {
    const plan = planAssistantOrder({
      cartLines: [cartLine(1, 3), cartLine(2, 1)],
      products,
      lines: [line(2, 2)],
      replacing: [line(1, 2)],
    });
    // P1: 3 en el carrito, 2 eran del asistente -> queda 1 (la del cliente). P2 sube a 3.
    expect(plan.updates).toEqual([
      { productId: 1, optionIds: [], notes: undefined, quantity: 1 },
      { productId: 2, optionIds: [], notes: undefined, quantity: 3 },
    ]);
    expect(plan.adds).toEqual([]);
  });

  it('quita la línea si todo era del asistente y no pasa de 20 piezas', () => {
    const plan = planAssistantOrder({
      cartLines: [cartLine(1, 2), cartLine(2, 19)],
      products,
      lines: [line(2, 2)],
      replacing: [line(1, 2)],
    });
    expect(plan.updates).toEqual([{ productId: 1, optionIds: [], notes: undefined, quantity: 0 }]);
    expect(plan.skipped).toEqual(['P2']);
  });

  it('canQuickAdd pide ficha si hay opciones obligatorias o está agotado', () => {
    expect(canQuickAdd(products[0])).toBe(true);
    expect(canQuickAdd(products[2])).toBe(false);
    expect(canQuickAdd(withRequiredOptions)).toBe(false);
    expect(canQuickAdd(undefined)).toBe(false);
  });
});
