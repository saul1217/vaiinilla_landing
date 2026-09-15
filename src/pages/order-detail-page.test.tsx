import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/theme-context';
import { OrderDetailPage } from './order-detail-page';

vi.mock('../lib/api', () => ({
  api: {
    getEstablishment: vi.fn(),
    getOrder: vi.fn().mockResolvedValue({
      id: 'ord-1',
      folio: 42,
      estado: 'listo',
      metodo_pago: 'saldo',
      destino: 'en_espacio',
      espacio: { id: 4, nombre: 'Mesa 4', tipo: 'mesa' },
      total: '70.00',
      notas_cocina: 'Sin cebolla',
      qr_token: 'ticket-token',
      items: [{ id: 1, nombre_producto: 'Burrito', cantidad: 1, subtotal: '70.00' }],
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

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,qr') },
}));

describe('OrderDetailPage', () => {
  it('muestra ticket con QR, mesa y pasos', async () => {
    render(
      <MemoryRouter initialEntries={['/cuenta/pedidos/ord-1']}>
        <ThemeProvider>
          <Routes>
            <Route path="/cuenta/pedidos/:id" element={<OrderDetailPage />} />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: /folio 42/i })).toBeInTheDocument();
    expect(await screen.findByAltText(/código qr del pedido/i)).toHaveAttribute(
      'src',
      'data:image/png;base64,qr',
    );
    expect(screen.getByText(/pagado con saldo/i)).toBeInTheDocument();
    expect(screen.getByText(/mesa 4/i)).toBeInTheDocument();
    expect(screen.getByText(/1 × burrito/i)).toBeInTheDocument();
    expect(screen.getByText(/sin cebolla/i)).toBeInTheDocument();
  });
});
