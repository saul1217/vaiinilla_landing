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
  });

  it('en mesa: lo lleva el mesero, no dice "barra"', () => {
    render(<OrderPickupPanel order={{ ...base, destino: 'en_espacio' }} token={null} />);
    expect(screen.getByText('Código de entrega')).toBeVisible();
    expect(screen.getByText(/mesero te lo lleva/i)).toBeVisible();
    expect(screen.queryByText(/barra/i)).toBeNull();
  });
});
