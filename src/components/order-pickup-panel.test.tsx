import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { OrderDetail } from '../types/api';
import { OrderPickupPanel } from './order-pickup-panel';

const base = {
  id: 'o1', folio: 5, estado: 'listo', metodo_pago: 'efectivo', destino: 'para_llevar', espacio: null,
  items: [], pago: null,
} as unknown as OrderDetail;

describe('OrderPickupPanel', () => {
  it('para llevar: se recoge en la barra', () => {
    render(<OrderPickupPanel order={base} token={null} />);
    expect(screen.getByText('Código de retiro')).toBeVisible();
    expect(screen.getByText(/barra/i)).toBeVisible();
    expect(screen.getByRole('region', { name: 'Pedido número 5. Código de retiro' })).toBeInTheDocument();
    expect(screen.getByText('#5')).toHaveAccessibleName('Número de pedido 5');
  });

  it('en mesa: lo lleva el mesero, no dice "barra"', () => {
    render(<OrderPickupPanel order={{ ...base, destino: 'en_espacio' }} token={null} />);
    expect(screen.getByText('Código de entrega')).toBeVisible();
    expect(screen.getByText(/mesero te lo lleva/i)).toBeVisible();
    expect(screen.queryByText(/barra/i)).toBeNull();
  });

  it('describe el código visible con palabras cotidianas y conserva su aparición condicionada', async () => {
    const { rerender } = render(<OrderPickupPanel order={base} token="pickup-5" />);
    expect(await screen.findByRole('img', { name: 'Código de retiro del pedido para mostrar en caja' })).toBeInTheDocument();
    rerender(<OrderPickupPanel order={{ ...base, estado: 'preparando' }} token="pickup-5" />);
    expect(screen.queryByRole('region', { name: 'Pedido número 5. Código de retiro' })).not.toBeInTheDocument();
  });
});
