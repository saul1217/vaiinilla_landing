import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rememberPickupQrToken } from '../lib/pickup-qr';
import type { OrderDetail } from '../types/api';
import { OrderTrackCard } from './order-track-card';

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,qr') },
}));

function order(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    id: 'ord-1',
    folio: 1,
    fecha_operativa: '2026-09-18',
    estado: 'listo',
    metodo_pago: 'stripe',
    destino: 'para_llevar',
    espacio: null,
    subtotal: '16.50',
    ahorro_combinado: '0.00',
    cashback_otorgado: '0.00',
    total: '16.50',
    version: 1,
    creado_en: '2026-09-18T12:00:00Z',
    actualizado_en: '2026-09-18T12:00:00Z',
    notas_cocina: null,
    usuario: { nombre: 'Ana', matricula: null },
    items: [
      {
        id: 1,
        producto_id: 1,
        nombre_producto: 'Chicharrones',
        estacion_preparacion: 'caja',
        cantidad: 1,
        precio_digital_unitario: '16.50',
        subtotal: '16.50',
        opciones: [],
      },
    ],
    pago: {
      payment_attempt_id: 'attempt-1',
      payment_intent_id: 'pi_1',
      stripe_account_id: 'acct_1',
      payment_status: 'confirmado',
    },
    ...overrides,
  };
}

function renderCard(next: OrderDetail, pickupToken: string | null = null) {
  return render(
    <MemoryRouter>
      <OrderTrackCard order={next} expanded onToggle={() => undefined} pickupToken={pickupToken} />
    </MemoryRouter>,
  );
}

describe('OrderTrackCard pickup', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('en listo muestra folio de retiro aunque no haya token', () => {
    renderCard(order({ qr_token: undefined }));
    expect(screen.getByRole('region', { name: /código de retiro/i })).toBeInTheDocument();
    expect(screen.getAllByText('#1').length).toBeGreaterThan(1);
    expect(screen.getByText(/muestra esto en la barra/i)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /código qr/i })).not.toBeInTheDocument();
  });

  it('en listo muestra QR si el token quedó persistido', async () => {
    rememberPickupQrToken('ord-1', 'pickup-secret');
    renderCard(order({ qr_token: undefined }));
    expect(await screen.findByRole('img', { name: /código qr del pedido/i })).toHaveAttribute(
      'src',
      'data:image/png;base64,qr',
    );
  });
});
