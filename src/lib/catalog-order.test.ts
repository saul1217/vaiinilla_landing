import { describe, expect, it } from 'vitest';
import { categoryRank, sortProductsForTodo } from './catalog-order';
import type { CatalogCategory, CatalogProduct } from '../types/api';

describe('catalog-order', () => {
  it('prioritizes COMIDA over BEBIDA and POSTRES', () => {
    expect(categoryRank('Comida')).toBeLessThan(categoryRank('Bebidas'));
    expect(categoryRank('Bebidas')).toBeLessThan(categoryRank('Postres'));
    expect(categoryRank('Snacks')).toBeLessThan(categoryRank('Cafetería'));
    expect(categoryRank('Tacos')).toBeLessThan(categoryRank('Jugos'));
  });

  it('sorts products in Todo as COMIDA → BEBIDA → POSTRES', () => {
    const categories: CatalogCategory[] = [
      { id: 1, nombre: 'Bebidas', orden: 1 },
      { id: 2, nombre: 'Postres', orden: 2 },
      { id: 3, nombre: 'Comida', orden: 3 },
    ];
    const products: CatalogProduct[] = [
      {
        id: 10,
        categoria_id: 1,
        estacion_preparacion: 'barra',
        nombre: 'Café Americano',
        descripcion: null,
        ingredientes: null,
        alergenos: null,
        tiempo_estimado_min: 3,
        precio_mostrador: '35.00',
        precio_digital: '35.00',
        disponible: true,
        imagen_url: null,
        grupos_opcion: [],
      },
      {
        id: 20,
        categoria_id: 2,
        estacion_preparacion: 'barra',
        nombre: 'Flan Casero',
        descripcion: null,
        ingredientes: null,
        alergenos: null,
        tiempo_estimado_min: 2,
        precio_mostrador: '45.00',
        precio_digital: '45.00',
        disponible: true,
        imagen_url: null,
        grupos_opcion: [],
      },
      {
        id: 30,
        categoria_id: 3,
        estacion_preparacion: 'cocina',
        nombre: 'Hamburguesa',
        descripcion: null,
        ingredientes: null,
        alergenos: null,
        tiempo_estimado_min: 10,
        precio_mostrador: '120.00',
        precio_digital: '120.00',
        disponible: true,
        imagen_url: null,
        grupos_opcion: [],
      },
    ];

    const sorted = sortProductsForTodo(products, categories);
    expect(sorted.map((p) => p.nombre)).toEqual([
      'Hamburguesa',
      'Café Americano',
      'Flan Casero',
    ]);
  });
});
