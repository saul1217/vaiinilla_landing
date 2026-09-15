import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/theme-context';
import { OrdersPage } from './orders-page';

vi.mock('../lib/api', () => ({
  api: {
    getEstablishment: vi.fn().mockResolvedValue({
      id: 'e1',
      nombre: 'Cafetería Demo A',
      slug: 'demo-a',
    }),
    listOrders: vi.fn().mockResolvedValue({
      orders: [
        {
          id: 'ord-1',
          folio: 42,
          estado: 'preparando',
          metodo_pago: 'efectivo',
          destino: 'para_llevar',
          espacio: null,
          total: '70.00',
          items: [],
        },
      ],
    }),
  },
}));

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({
    user: { email: 'ana@example.test', displayName: 'Ana' },
    ready: true,
    configured: true,
    signOut: vi.fn(),
  }),
}));

vi.mock('../context/cart-context', () => ({
  useCart: () => ({ cart: { slug: 'demo-a', establishmentName: 'Demo A', lines: [] } }),
}));

vi.mock('../context/buyer-session', () => ({
  useBuyerSession: () => ({
    context: { access_token: 'jwt', contexto: { establecimiento_id: 'e1' } },
    opening: false,
    openClientSession: vi.fn(),
    clearSession: vi.fn(),
  }),
}));

describe('OrdersPage', () => {
  it('lista pedidos como tarjetas con folio y estado', async () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <OrdersPage />
        </ThemeProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('link', { name: /folio 42/i })).toHaveAttribute(
      'href',
      '/cuenta/pedidos/ord-1',
    );
    expect(screen.getByText(/preparando/i)).toBeInTheDocument();
    expect(screen.getByText(/para llevar/i)).toBeInTheDocument();
    expect(screen.getByText('$70.00 MXN')).toBeInTheDocument();
  });
});
