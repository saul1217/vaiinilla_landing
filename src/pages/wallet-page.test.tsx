import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/theme-context';
import { WalletPage } from './wallet-page';

vi.mock('../lib/api', () => ({
  api: {
    getEstablishment: vi.fn(),
    getMyWallet: vi.fn().mockResolvedValue({
      cliente: { usuario_id: 'u1', nombre: 'Ana Pérez', identificador_cliente: 'A01234' },
      wallet: { id: 'w1', usuario_id: 'u1', establecimiento_id: 'e1', saldo: '125.00', actualizado_en: null },
      movimientos: [
        {
          id: 'm1',
          tipo: 'pedido',
          descripcion: 'Pedido #42',
          monto: '70.00',
          saldo_posterior: '55.00',
          pedido_id: 'ord-1',
          creado_en: '2026-09-15T00:00:00Z',
        },
      ],
    }),
  },
}));

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({
    user: { email: 'ana@example.test', displayName: 'Ana Pérez' },
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
    context: {
      access_token: 'jwt',
      contexto: { establecimiento_id: 'e1' },
    },
    opening: false,
    openClientSession: vi.fn(),
    clearSession: vi.fn(),
  }),
}));

describe('WalletPage', () => {
  it('muestra saldo grande y atajos de Android', async () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <WalletPage />
        </ThemeProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('$125.00 MXN')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /tu saldo/i })).toBeInTheDocument();
    const shortcuts = document.querySelector('.alumno-actions-3');
    expect(shortcuts).toBeTruthy();
    expect(within(shortcuts as HTMLElement).getByRole('link', { name: /^pagar$/i })).toHaveAttribute(
      'href',
      '/e/demo-a/carrito',
    );
    expect(within(shortcuts as HTMLElement).getByRole('link', { name: /^pedidos$/i })).toHaveAttribute(
      'href',
      '/cuenta/pedidos',
    );
    expect(within(shortcuts as HTMLElement).getByRole('link', { name: /^recargar$/i })).toHaveAttribute(
      'href',
      '/cuenta',
    );
    expect(screen.getByRole('link', { name: /abrir menú/i })).toHaveAttribute('href', '/e/demo-a');
    expect(screen.getByText('Pedido #42')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/ana pérez/i)).toBeInTheDocument());
  });
});
