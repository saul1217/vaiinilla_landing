import { useEffect } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { CartProvider, useCart } from './cart-context';
import type { CatalogProduct } from '../types/api';

function CartCleanupProbe() {
  const { cart, resetTableSession } = useCart();
  useEffect(() => resetTableSession(5, 'session-a'), [resetTableSession]);
  return <p>{cart ? 'carrito con productos' : 'carrito vacío'}</p>;
}

const PRODUCT: CatalogProduct = {
  id: 1, categoria_id: 1, estacion_preparacion: 'cocina', nombre: 'Agua',
  descripcion: null, ingredientes: null, alergenos: null, tiempo_estimado_min: 5,
  precio_mostrador: '20.00', precio_digital: '20.00', disponible: true,
  imagen_url: null, grupos_opcion: [],
};

function AddTableItemProbe() {
  const { addLine } = useCart();
  useEffect(() => addLine('usagi', 'Usagi', PRODUCT, [], 1), [addLine]);
  return null;
}

function AssociateTableProbe() {
  const { cart, associateTableSession } = useCart();
  useEffect(() => associateTableSession('usagi', 5, 'session-a'), [associateTableSession]);
  return <p>{cart?.tableSession?.sesionId ?? 'sin sesión'}</p>;
}

describe('carrito asociado a sesión de mesa', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('elimina el carrito de la sesión que terminó', async () => {
    localStorage.setItem('vaiinilla.buyer.cart.v1', JSON.stringify({
      slug: 'usagi',
      establishmentName: 'Usagi',
      lines: [{ productId: 1 }],
      tableSession: { espacioId: 5, sesionId: 'session-a' },
    }));

    render(<CartProvider><CartCleanupProbe /></CartProvider>);

    await waitFor(() => expect(screen.getByText('carrito vacío')).toBeInTheDocument());
    expect(localStorage.getItem('vaiinilla.buyer.cart.v1')).toBeNull();
  });

  it('asocia los nuevos carritos al espacio y participante activos', async () => {
    localStorage.setItem('vaiinilla.buyer.space.v1', JSON.stringify({
      slug: 'usagi', espacioId: 5, nombre: 'Mesa 5', tipo: 'mesa',
    }));
    localStorage.setItem('vaiinilla.buyer.table-participant.v1', JSON.stringify({
      slug: 'usagi', espacioId: 5, sesionId: 'session-a', participanteId: 'p-a', alias: 'Ana',
    }));

    render(<CartProvider><AddTableItemProbe /></CartProvider>);

    await waitFor(() => {
      const cart = JSON.parse(localStorage.getItem('vaiinilla.buyer.cart.v1') ?? 'null') as {
        tableSession?: { espacioId: number; sesionId?: string };
      } | null;
      expect(cart?.tableSession).toEqual({ espacioId: 5, sesionId: 'session-a' });
    });
  });

  it('liga un carrito previo al contexto de la mesa al confirmar la sesión activa', async () => {
    localStorage.setItem('vaiinilla.buyer.cart.v1', JSON.stringify({
      slug: 'usagi', establishmentName: 'Usagi', lines: [{ productId: 1 }],
    }));
    render(<CartProvider><AssociateTableProbe /></CartProvider>);

    expect(await screen.findByText('session-a')).toBeInTheDocument();
    const cart = JSON.parse(localStorage.getItem('vaiinilla.buyer.cart.v1') ?? 'null') as {
      tableSession?: { espacioId: number; sesionId?: string };
    } | null;
    expect(cart?.tableSession).toEqual({ espacioId: 5, sesionId: 'session-a' });
  });

  it('conserva el carrito de otra sesión de la misma mesa', async () => {
    localStorage.setItem('vaiinilla.buyer.cart.v1', JSON.stringify({
      slug: 'usagi',
      establishmentName: 'Usagi',
      lines: [{ productId: 1 }],
      tableSession: { espacioId: 5, sesionId: 'session-b' },
    }));

    render(<CartProvider><CartCleanupProbe /></CartProvider>);

    expect(await screen.findByText('carrito con productos')).toBeInTheDocument();
    expect(localStorage.getItem('vaiinilla.buyer.cart.v1')).not.toBeNull();
  });
});
