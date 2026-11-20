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

  it('listo: muestra el código de 4 dígitos y la fila donde formarse', () => {
    render(
      <OrderPickupPanel
        order={{ ...base, codigo_recoger: '0133', fila: { id: 3, nombre: 'Barra 3', express: false } }}
        token={null}
      />,
    );
    expect(screen.getByText('0133')).toHaveAccessibleName('Código 0 1 3 3');
    expect(screen.getByText(/dicta este código/i)).toBeVisible();
    expect(screen.getByText('Barra 3')).toBeVisible();
  });

  it('preparando: ya dice en qué fila lo va a recoger, sin enseñar el código', () => {
    render(
      <OrderPickupPanel
        order={{ ...base, estado: 'preparando', codigo_recoger: '0133', fila: { id: 4, nombre: 'Fila 4', express: true } }}
        token={null}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Cuando esté listo, recógelo en Fila 4 (express).');
    expect(screen.queryByText('0133')).toBeNull();
  });

  it('a domicilio no habla de filas', () => {
    const { container } = render(
      <OrderPickupPanel
        order={{ ...base, estado: 'preparando', destino: 'a_domicilio', fila: { id: 4, nombre: 'Fila 4', express: false } }}
        token={null}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('OrderPickupPanel según cómo valida el negocio', () => {
  it('«solo código»: el código grande y el QR plegado para cuando se bloquee', async () => {
    render(<OrderPickupPanel order={{ ...base, codigo_recoger: '0133' }} token="pickup-5" rules={{ mode: 'codigo' }} />);
    expect(screen.getByText('Dicta este código')).toBeVisible();
    expect(await screen.findByText('Si el código se bloquea, muestra este QR')).toBeInTheDocument();
  });

  it('«solo QR»: sin código', async () => {
    render(<OrderPickupPanel order={{ ...base, codigo_recoger: '0133' }} token="pickup-5" rules={{ mode: 'qr' }} />);
    expect(await screen.findByRole('img', { name: /Código de retiro/ })).toBeInTheDocument();
    expect(screen.queryByText('0133')).toBeNull();
  });

  it('por pagar en caja con el cobro con código: enseña su código', () => {
    render(<OrderPickupPanel order={{ ...base, estado: 'por_cobrar', codigo_recoger: '0133' }} token={null} rules={{ mode: 'qr_o_codigo', cobroCodigo: true }} />);
    expect(screen.getByText('0133')).toBeVisible();
  });
});
