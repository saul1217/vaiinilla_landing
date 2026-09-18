import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
          items: [{ id: 1, producto_id: 10, nombre_producto: 'Quiere keke', cantidad: 1, subtotal: '70.00' }],
        },
      ],
    }),
    getGuestCatalog: vi.fn().mockResolvedValue({
      categorias: [],
      productos: [
        {
          id: 10,
          nombre: 'Quiere keke',
          disponible: true,
          imagen_url: 'https://cdn.example/keke.jpg',
          grupos_opcion: [],
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
    expect(await screen.findByRole('heading', { name: /mis pedidos/i })).toBeInTheDocument();
    expect(screen.getByText('#42')).toBeInTheDocument();
    expect(screen.getByText(/1 quiere keke/i)).toBeInTheDocument();
    expect(screen.getByText(/para llevar · efectivo/i)).toBeInTheDocument();
    expect(screen.getByText('$70')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ver seguimiento/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(document.querySelector('img.alumno-track-card__thumb')).toHaveAttribute(
        'src',
        'https://cdn.example/keke.jpg',
      );
    });
  });

  it('expande el seguimiento con timeline y pedido completo', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ThemeProvider>
          <OrdersPage />
        </ThemeProvider>
      </MemoryRouter>,
    );
    await user.click(await screen.findByRole('button', { name: /ver seguimiento/i }));
    expect(screen.getByText(/pago confirmado|por cobrar/i)).toBeInTheDocument();
    expect(document.querySelectorAll('.alumno-timeline li')).toHaveLength(5);
    expect(document.querySelector('.alumno-timeline li.is-current .alumno-timeline__mark')?.textContent).toBe(
      '3',
    );
    expect(document.querySelectorAll('.alumno-timeline li.is-done svg')).toHaveLength(2);
    expect(screen.getByRole('link', { name: /ver pedido completo/i })).toHaveAttribute(
      'href',
      '/cuenta/pedidos/ord-1',
    );
    expect(screen.getByRole('button', { name: /ocultar seguimiento/i })).toBeInTheDocument();
  });
});
