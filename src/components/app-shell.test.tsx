import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './app-shell';

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: { email: 'ana@example.test' }, ready: true, configured: true, signOut: vi.fn() }),
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
});
