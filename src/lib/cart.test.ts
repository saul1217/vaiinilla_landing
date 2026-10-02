import { describe, expect, it } from 'vitest';
import type { CatalogProduct } from '../types/api';
import { cartTotal, defaultOptionIds, previewForProduct, toCreateOrderInput, validateSelections } from './cart';

const burrito = {
  id: 103,
  categoria_id: 20,
  estacion_preparacion: 'cocina',
  nombre: 'Burrito norteño',
  descripcion: null,
  ingredientes: null,
  alergenos: null,
  tiempo_estimado_min: 10,
  precio_mostrador: '64.00',
  precio_digital: '64.00',
  disponible: true,
  imagen_url: 'fixture://burrito',
  grupos_opcion: [
    {
      id: 210,
      nombre: 'Proteína',
      min_selecciones: 1,
      max_selecciones: 1,
      opciones: [
        { id: 310, nombre: 'Res', precio_extra: '7.00' },
        { id: 311, nombre: 'Pollo', precio_extra: '0.00' },
      ],
    },
    {
      id: 211,
      nombre: 'Salsa',
      min_selecciones: 1,
      max_selecciones: 1,
      opciones: [{ id: 314, nombre: 'Roja', precio_extra: '5.00' }],
    },
  ],
} satisfies CatalogProduct;

describe('cart contract', () => {
  it('exige cardinalidad de grupos', () => {
    expect(validateSelections(burrito, [310, 314])).toBeNull();
    expect(validateSelections(burrito, [310])).toBeTruthy();
    expect(validateSelections(burrito, [310, 311, 314])).toBeTruthy();
    expect(validateSelections(burrito, [310, 314, 999])).toBeTruthy();
  });

  it('arma POST /pedidos para llevar con efectivo o saldo', () => {
    expect(defaultOptionIds(burrito)).toEqual([310, 314]);
    expect(
      toCreateOrderInput(
        [
          {
            productId: 103,
            quantity: 1,
            optionIds: [314, 310],
            productName: 'Burrito norteño',
            unitPreview: '82.00',
            imageUrl: null,
          },
        ],
        'saldo',
        'Sin cebolla',
      ),
    ).toEqual({
      metodo_pago: 'saldo',
      destino: 'para_llevar',
      espacio_id: null,
      notas_cocina: 'Sin cebolla',
      items: [{ producto_id: 103, cantidad: 1, opcion_ids: [310, 314] }],
    });
  });

  it('arma POST /pedidos en_espacio con stripe sin montos confiables', () => {
    const payload = toCreateOrderInput(
      [
        {
          productId: 103,
          quantity: 1,
          optionIds: [314, 310],
          productName: 'Burrito norteño',
          unitPreview: '82.00',
          imageUrl: null,
        },
      ],
      'stripe',
      '',
      'en_espacio',
      12,
    );
    const raw = JSON.stringify(payload);
    expect(payload).toMatchObject({
      metodo_pago: 'stripe',
      destino: 'en_espacio',
      espacio_id: 12,
      items: [{ producto_id: 103, cantidad: 1, opcion_ids: [310, 314] }],
    });
    expect(raw).not.toContain('"total"');
    expect(raw).not.toContain('precio_unitario');
    expect(raw).not.toContain('application_fee');
    expect(raw).not.toContain('client_secret');
    expect(raw).not.toContain('stripe_account_id');
  });
});

// Regresión: sin pasar la comisión, el menú manda el precio de mostrador y el carrito suma exactamente
// eso (más los extras). La web no aplica ningún recargo propio.
describe('el carrito no agrega recargo', () => {
  it('una línea cuesta el precio del menú más sus extras, por cantidad', () => {
    expect(previewForProduct(burrito, [311, 314], 1)).toEqual({ unit: '69.00', line: '69.00' });
    expect(previewForProduct(burrito, [310, 314], 3)).toEqual({ unit: '76.00', line: '228.00' });
  });

  it('el total es la suma exacta de las líneas', () => {
    const line = (unit: string, quantity: number) => ({
      productId: 103, quantity, optionIds: [311, 314], productName: 'Burrito norteño', unitPreview: unit, imageUrl: null,
    });
    expect(cartTotal([line('69.00', 2), line('25.00', 1)])).toBe('163.00');
  });

  it('un producto a precio de mostrador exacto no sube al agregarlo al carrito', () => {
    const exacto = { ...burrito, grupos_opcion: [], precio_mostrador: '120.00', precio_digital: '120.00' };
    expect(previewForProduct(exacto, [], 1)?.unit).toBe('120.00');
  });
});
