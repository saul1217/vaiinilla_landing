import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ArrivalClient } from '../lib/arrival-api';
import type { OrderDetail } from '../types/api';
import { ArrivalButton } from './arrival-button';
import { OrderTrackCard } from './order-track-card';

function order(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    id: 'p1',
    folio: 12,
    estado: 'preparando',
    metodo_pago: 'stripe',
    destino: 'para_llevar',
    espacio: null,
    total: '80.00',
    items: [{ id: 1, nombre_producto: 'Hamburguesa', cantidad: 1 }],
    ...overrides,
  } as OrderDetail;
}

function client(overrides: Partial<ArrivalClient> = {}): ArrivalClient {
  return {
    isDriveThru: vi.fn(() => Promise.resolve(true)),
    announce: vi.fn(() => Promise.resolve(order({ llegada_en: '2026-09-30T18:32:00' }))),
    ...overrides,
  };
}

describe('Ya llegué', () => {
  it('avisa una vez y muestra la hora', async () => {
    const c = client();
    const user = userEvent.setup();
    render(<ArrivalButton order={order()} client={c} />);
    await user.click(await screen.findByRole('button', { name: /ya llegué/i }));
    expect(c.announce).toHaveBeenCalledWith('p1');
    expect(await screen.findByText(/avisamos que llegaste/i)).toBeInTheDocument();
    expect(screen.getByText(/desde las 18:32/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ya llegué/i })).not.toBeInTheDocument();
  });

  it('si ya avisó, lo muestra sin ofrecer el botón', async () => {
    const c = client();
    render(<ArrivalButton order={order({ llegada_en: '2026-09-30T18:20:00' })} client={c} />);
    expect(await screen.findByText(/avisamos que llegaste/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ya llegué/i })).not.toBeInTheDocument();
  });

  it('no sale si el negocio no es un drive-thru', async () => {
    const c = client({ isDriveThru: vi.fn(() => Promise.resolve(false)) });
    render(<ArrivalButton order={order()} client={c} />);
    await waitFor(() => expect(c.isDriveThru).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /ya llegué/i })).not.toBeInTheDocument();
  });

  it('no sale en un pedido en mesa, entregado ni en una renta', () => {
    const c = client();
    for (const next of [
      order({ destino: 'en_espacio', espacio: { id: 4, nombre: 'Mesa 4', tipo: 'mesa' } }),
      order({ estado: 'entregado' }),
      order({ reserva: { id: 'r', inicio: '', fin: '', duracion_min: 60, estado: 'confirmada' } }),
    ]) {
      const { unmount } = render(<ArrivalButton order={next} client={c} />);
      expect(screen.queryByRole('button', { name: /ya llegué/i })).not.toBeInTheDocument();
      unmount();
    }
    expect(c.isDriveThru).not.toHaveBeenCalled();
  });

  it('si falla, lo dice y deja reintentar', async () => {
    const c = client({ announce: vi.fn(() => Promise.reject(new Error('Sin conexión'))) });
    const user = userEvent.setup();
    render(<ArrivalButton order={order()} client={c} />);
    await user.click(await screen.findByRole('button', { name: /ya llegué/i }));
    expect(await screen.findByText(/sin conexión/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ya llegué/i })).toBeEnabled();
  });
});

describe('tarjeta de seguimiento: renta y cuenta', () => {
  function card(next: OrderDetail) {
    return render(
      <MemoryRouter>
        <OrderTrackCard order={next} expanded onToggle={() => undefined} arrivalClient={client({ isDriveThru: vi.fn(() => Promise.resolve(false)) })} />
      </MemoryRouter>,
    );
  }

  it('una renta se ve como renta, no como comida', () => {
    const start = new Date(Date.now() + 3 * 3600_000);
    const end = new Date(start.getTime() + 3600_000);
    card(
      order({
        estado: 'entregado',
        metodo_pago: 'saldo',
        items: [{ id: 1, nombre_producto: 'Renta Cancha 2 · 60 min', cantidad: 1 }] as OrderDetail['items'],
        reserva: {
          id: 'r1',
          espacio: { id: 7, nombre: 'Cancha 2', tipo: 'cancha' },
          inicio: start.toISOString(),
          fin: end.toISOString(),
          duracion_min: 60,
          estado: 'confirmada',
        },
      }),
    );
    expect(screen.getAllByText('Reservada').length).toBeGreaterThan(0);
    expect(screen.getByText(/^Cancha 2 · .*\d{2}:\d{2}–\d{2}:\d{2}$/)).toBeInTheDocument();
    for (const label of ['Por pagar', 'Reservada', 'En juego', 'Terminada']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText(/cocina recibió/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/para llevar/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/entregado/i)).not.toBeInTheDocument();
  });

  it('un pedido a la cuenta dice que se paga al final', () => {
    card(
      order({
        estado: 'cobrado',
        metodo_pago: 'efectivo',
        destino: 'en_espacio',
        espacio: { id: 4, nombre: 'Mesa 4', tipo: 'mesa' },
        pago_diferido: true,
        pago_pendiente: true,
        pago: null,
      }),
    );
    expect(screen.getAllByText('Pedido recibido').length).toBeGreaterThan(0);
    expect(screen.getByText(/Mesa 4 · Pagas al final/)).toBeInTheDocument();
    expect(screen.getAllByText('Pedido recibido').length).toBeGreaterThan(0);
    expect(screen.queryByText('Por cobrar')).not.toBeInTheDocument();
  });
});
