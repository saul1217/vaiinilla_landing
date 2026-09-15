import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { HomePage } from './home-page';

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: null, ready: true, configured: false, signOut: vi.fn() }),
}));

vi.mock('../context/cart-context', () => ({
  useCart: () => ({ cart: null }),
}));

describe('HomePage', () => {
  it('manda al comprador a /pedir y al staff a app.vaiinilla.app', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    const buyerLinks = screen.getAllByRole('link', { name: /pedir ahora/i });
    expect(buyerLinks[0]).toHaveAttribute('href', '/pedir');
    expect(screen.getByRole('link', { name: /abrir el panel/i })).toHaveAttribute(
      'href',
      'https://app.vaiinilla.app',
    );
  });
});
