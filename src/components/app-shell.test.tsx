import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './app-shell';

const authState: { user: null | { email: string } } = {
  user: { email: 'ana@example.test' },
};

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: authState.user, ready: true, configured: true, signOut: vi.fn() }),
}));

vi.mock('../context/cart-context', () => ({
  useCart: () => ({
    cart: {
      slug: 'demo-a',
      establishmentName: 'Cafetería Demo A',
      lines: [{ productId: 1, quantity: 2, optionIds: [], productName: 'Taco', unitPreview: '20.00', imageUrl: null }],
    },
  }),
}));

describe('AppShell', () => {
  beforeEach(() => {
    authState.user = { email: 'ana@example.test' };
    localStorage.clear();
    sessionStorage.clear();
  });

  it('muestra la bottom nav de alumno y no la de marketing', () => {
    render(
      <MemoryRouter>
        <AppShell tab="menu">
          <main>contenido</main>
        </AppShell>
      </MemoryRouter>,
    );
    expect(screen.getByRole('navigation', { name: /^navegación$/i })).toBeInTheDocument();
    const menu = screen.getByRole('link', { name: /menú/i });
    expect(menu).toHaveAttribute('href', '/e/demo-a');
    expect(menu.querySelector('svg path')?.getAttribute('d') ?? '').toMatch(/12 /);
    expect(screen.getByRole('link', { name: /pedidos/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /cartera/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /carrito/i })).toHaveAttribute('href', '/e/demo-a/carrito');
    expect(screen.queryByRole('link', { name: /abrir el panel/i })).not.toBeInTheDocument();
  });

  it('invitado con llave: Menú, Pedidos y Carrito, sin Cartera', () => {
    authState.user = null;
    localStorage.setItem('vaiinilla.buyer.guest.v1', JSON.stringify({ nombre: 'Lupi', llave: 'K'.repeat(43) }));
    render(
      <MemoryRouter>
        <AppShell tab="orders">
          <main>contenido</main>
        </AppShell>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /menú/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /pedidos/i })).toHaveAttribute('href', '/cuenta/pedidos');
    expect(screen.getByRole('link', { name: /carrito/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /cartera/i })).not.toBeInTheDocument();
  });

  it('tras "Comprar sin cuenta" (aún sin pedido) el dock no manda a iniciar sesión', () => {
    authState.user = null;
    sessionStorage.setItem('vaiinilla.buyer.guest-buy.v1', '1');
    render(
      <MemoryRouter>
        <AppShell tab="menu">
          <main>contenido</main>
        </AppShell>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /pedidos/i })).toHaveAttribute('href', '/cuenta/pedidos');
    expect(screen.queryByRole('link', { name: /cartera/i })).not.toBeInTheDocument();
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href') ?? '').not.toMatch(/^\/cuenta\?next=/);
    }
  });

  it('sin llave, Pedidos invita a entrar', () => {
    authState.user = null;
    render(
      <MemoryRouter>
        <AppShell tab="menu">
          <main>contenido</main>
        </AppShell>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /pedidos/i })).toHaveAttribute('href', '/cuenta?next=/cuenta/pedidos');
  });

  it('el logo no abre solo un lugar visitado antes: lleva a elegir con QR o código', () => {
    localStorage.setItem('vaiinilla.buyer.last-place.v1', 'padel-club');
    render(
      <MemoryRouter>
        <AppShell tab="menu">
          <main>contenido</main>
        </AppShell>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /^vaiinilla$/i })).toHaveAttribute('href', '/pedir');
  });

  it('notifica sesión terminada cuando ocurre 401', async () => {
    const { notifyUnauthorized } = await import('../lib/unauthorized');
    render(
      <MemoryRouter initialEntries={['/e/demo-a']}>
        <AppShell tab="menu">
          <main>contenido</main>
        </AppShell>
      </MemoryRouter>,
    );
    expect(() => notifyUnauthorized()).not.toThrow();
  });
});
