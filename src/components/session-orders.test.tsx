import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { OrderDetail } from '../types/api';
import { SessionOrdersCard } from './session-orders';
import { groupOrdersBySession } from '../lib/session-orders';

function order(id: string, folio: number, sessionId: string | null, createdAt: string): OrderDetail {
  return {
    id,
    folio,
    fecha_operativa: createdAt.slice(0, 10),
    estado: 'entregado',
    metodo_pago: 'efectivo',
    destino: sessionId ? 'en_espacio' : 'para_llevar',
    sesion_espacio_id: sessionId,
    sesion_espacio_estado: sessionId ? 'abierta' : null,
    espacio: sessionId ? { id: 67, nombre: 'Mesa 67', tipo: 'mesa' } : null,
    total: '20.00',
    creado_en: createdAt,
    actualizado_en: createdAt,
    notas_cocina: null,
    usuario: null,
    subtotal: '20.00',
    ahorro_combinado: '0.00',
    cashback_otorgado: '0.00',
    version: 1,
    pago_diferido: true,
    items: [{
      id: Number(folio), producto_id: 1, nombre_producto: `Producto ${folio}`, cantidad: 1,
      precio_digital_unitario: '20.00', subtotal: '20.00', imagen_url: null,
      estacion_preparacion: 'cocina', opciones: [], rechazo: null,
    }],
  };
}

describe('pedidos de una sesión de mesa', () => {
  it('muestra una tarjeta por sesión con todos sus pedidos y conserva takeout individual', () => {
    const orders = [
      order('p-33', 33, 'ses-a', '2026-10-08T18:00:00.000Z'),
      order('p-34', 34, 'ses-a', '2026-10-08T18:05:00.000Z'),
      order('p-35', 35, 'ses-a', '2026-10-08T18:10:00.000Z'),
      order('p-36', 36, null, '2026-10-08T18:12:00.000Z'),
    ];
    const groups = groupOrdersBySession(orders);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.sessionId).toBe('ses-a');
    expect(groups[0]?.orders.map((item) => item.folio)).toEqual([33, 34, 35]);
    expect(orders.filter((item) => !item.sesion_espacio_id).map((item) => item.folio)).toEqual([36]);

    render(<MemoryRouter><SessionOrdersCard group={groups[0]!} /></MemoryRouter>);
    expect(screen.getByRole('article', { name: 'Pedidos de Mesa 67' })).toBeInTheDocument();
    expect(screen.getByText('3 pedidos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver mesa' })).toHaveAttribute('href', '/cuenta/pedidos#mesa-activa');
    for (const folio of [33, 34, 35]) {
      expect(screen.queryByText(`Pedido #${folio}`)).not.toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole('button', { name: 'Ver pedidos de la sesión' }));
    for (const folio of [33, 34, 35]) {
      expect(screen.getByText(`Pedido #${folio}`)).toBeInTheDocument();
    }
  });

  it('mantiene sesiones distintas separadas y manda las cerradas a historial', () => {
    const groups = groupOrdersBySession([
      order('p-a', 1, 'ses-a', '2026-10-08T18:00:00.000Z'),
      { ...order('p-b', 2, 'ses-b', '2026-10-08T17:00:00.000Z'), sesion_espacio_estado: 'cerrada' },
    ]);

    expect(groups.map((item) => [item.sessionId, item.sessionState])).toEqual([
      ['ses-a', 'abierta'],
      ['ses-b', 'cerrada'],
    ]);
  });

  it('el CTA de sesión navega al ancla de la mesa activa', () => {
    const group = groupOrdersBySession([order('p-33', 33, 'ses-a', '2026-10-08T18:00:00.000Z')])[0]!;
    function LocationProbe() {
      const location = useLocation();
      return <p data-testid="route-location">{location.pathname}{location.hash}</p>;
    }

    render(
      <MemoryRouter initialEntries={['/cuenta/pedidos']}>
        <Routes>
          <Route
            path="/cuenta/pedidos"
            element={<><LocationProbe /><SessionOrdersCard group={group} /></>}
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Ver mesa' }));
    expect(screen.getByTestId('route-location')).toHaveTextContent('/cuenta/pedidos#mesa-activa');
  });
});
