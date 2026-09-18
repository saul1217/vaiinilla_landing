import { describe, expect, it } from 'vitest';
import { catalogImageMap, orderThumbUrl, productImageUrl } from './catalog-images';
import type { CatalogProduct, OrderDetail } from '../types/api';

describe('catalog-images', () => {
  it('resuelve la foto del catálogo y si no hay, deja el hueco para Vaini', () => {
    const products = [
      { id: 1, nombre: 'Quiere keke', imagen_url: 'https://cdn.example/keke.jpg' },
      { id: 2, nombre: 'Chocolate', imagen_url: null },
      { id: 3, nombre: 'Vacío', imagen_url: '   ' },
    ] as CatalogProduct[];
    const images = catalogImageMap(products);
    expect(productImageUrl('   ')).toBeNull();
    expect(orderThumbUrl({ items: [{ producto_id: 1 }] } as OrderDetail, images)).toBe(
      'https://cdn.example/keke.jpg',
    );
    expect(orderThumbUrl({ items: [{ producto_id: 2 }] } as OrderDetail, images)).toBeNull();
    expect(orderThumbUrl({ items: [{ producto_id: 3 }] } as OrderDetail, images)).toBeNull();
  });

  it('usa el siguiente ítem o el nombre si el primero no tiene foto', () => {
    const products = [
      { id: 2, nombre: 'Quiere keke', imagen_url: 'https://cdn.example/keke.jpg' },
    ] as CatalogProduct[];
    const images = catalogImageMap(products);
    expect(
      orderThumbUrl(
        { items: [{ producto_id: 9 }, { producto_id: 2 }] } as OrderDetail,
        images,
      ),
    ).toBe('https://cdn.example/keke.jpg');
    expect(
      orderThumbUrl(
        { items: [{ producto_id: 80, nombre_producto: 'Quiere keke' }] } as OrderDetail,
        images,
        products,
      ),
    ).toBe('https://cdn.example/keke.jpg');
  });
});
