import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProductSheet } from './product-sheet';
import type { CatalogProduct } from '../types/api';

const product = {
  id: 1,
  nombre: 'Tacos de birria',
  descripcion: 'Orden con cebolla y cilantro',
  ingredientes: 'Res, cebolla, cilantro y limón',
  alergenos: null,
  tiempo_estimado_min: 12,
  precio_digital: '85.00',
  disponible: true,
  imagen_url: null,
  grupos_opcion: [],
} as unknown as CatalogProduct;

function renderSheet() {
  const onQuantityChange = vi.fn();
  const onAdd = vi.fn(() => true);
  const onClosed = vi.fn();
  render(
    <ProductSheet
      product={product}
      placeName="Cafetería Demo"
      photoUrl={null}
      optionIds={[]}
      quantity={1}
      lineTotal="85.00"
      error={null}
      canAddToCart
      loginHref="/cuenta"
      onToggleOption={() => undefined}
      onClearGroup={() => undefined}
      onQuantityChange={onQuantityChange}
      onAdd={onAdd}
      onClosed={onClosed}
    />,
  );
  return { onQuantityChange, onAdd };
}

describe('ProductSheet', () => {
  it('muestra instrucciones completas, controles táctiles con nombres y conserva nota y cantidad al agregar', () => {
    const { onQuantityChange, onAdd } = renderSheet();
    expect(screen.getByText('Sin extras')).toBeInTheDocument();
    const notes = screen.getByLabelText('Instrucciones para preparar (opcional)');
    fireEvent.change(notes, { target: { value: 'Salsa aparte, por favor' } });
    fireEvent.click(screen.getByRole('button', { name: 'Más' }));
    expect(onQuantityChange).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: /agregar/i }));
    expect(onAdd).toHaveBeenCalledWith('Salsa aparte, por favor');
  });

  it('ofrece un control claro para cerrar la ficha', () => {
    renderSheet();
    expect(screen.getByRole('button', { name: 'Cerrar producto' })).toBeInTheDocument();
  });
});
