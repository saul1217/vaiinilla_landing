import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/theme-context';
import { WalletBoardView, WalletPage } from './wallet-page';

vi.mock('../lib/api', () => ({
  api: {
    getEstablishment: vi.fn(),
    getGuestCatalog: vi.fn().mockResolvedValue({
      categorias: [],
      productos: [
        {
          id: 2,
          categoria_id: 1,
          estacion_preparacion: 'caja',
          nombre: 'fruti Lupis',
          descripcion: null,
          ingredientes: null,
          alergenos: null,
          tiempo_estimado_min: 4,
          precio_mostrador: '22.00',
          precio_digital: '22.00',
          disponible: true,
          imagen_url: null,
          grupos_opcion: [],
        },
      ],
    }),
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
    expect(await screen.findByText('$125.00')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /cartera/i })).toBeInTheDocument();
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
      '/u/u1',
    );
    expect(screen.getByRole('link', { name: /abrir menú/i })).toHaveAttribute('href', '/e/demo-a');
    expect(screen.getByText('Saldo Vaiinilla')).toBeInTheDocument();
    expect(screen.getByText('Pedido #42')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /del menú/i })).toBeInTheDocument();
    expect(screen.getByText('fruti Lupis')).toBeInTheDocument();
  });

  it('vacío: clipboard, $0.00, atajos y sin movimientos inventados', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <WalletBoardView
            saldo="0.00"
            placeSlug="demo-a"
            reloadHref="/u/preview"
            movimientos={[]}
            menuPeek={[]}
          />
        </ThemeProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.getByText('Saldo Vaiinilla')).toBeInTheDocument();
    expect(document.querySelector('[data-wallet-orb="clipboard"]')).toBeTruthy();
    expect(document.querySelector('[data-wallet-pay="cart"]')).toBeTruthy();
    expect(document.querySelector('[data-wallet-orders="list"]')).toBeTruthy();
    expect(document.querySelector('[data-wallet-reload="qr"]')).toBeTruthy();
    expect(document.querySelector('[data-wallet-menu="book"]')).toBeTruthy();
    expect(document.querySelectorAll('[data-wallet-menu="book"] path')).toHaveLength(1);
    expect(document.querySelectorAll('[data-wallet-menu="book"] rect')).toHaveLength(0);
    expect(document.querySelector('[data-wallet-menu="book"] path')).toHaveAttribute('fill-rule', 'evenodd');
    expect(document.querySelector('[data-wallet-menu="book"]')?.innerHTML).not.toContain('menu-book-gap');
    expect(document.querySelector('[data-wallet-menu-chev="arrow"]')).toBeTruthy();
    expect(screen.getByRole('link', { name: /^pagar$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^pedidos$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^recargar$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /abrir menú/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /movimientos/i })).not.toBeInTheDocument();
    expect(document.querySelectorAll('.alumno-moves li')).toHaveLength(0);
  });
});
