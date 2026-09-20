import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from './home-page';
import { rememberPlace } from '../lib/last-place';

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: null, ready: true, configured: false, signOut: vi.fn() }),
}));

vi.mock('../context/cart-context', () => ({
  useCart: () => ({ cart: null }),
}));

describe('HomePage', () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('manda al comprador a /pedir y al staff a app.vaiinilla.app como terciario', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    const pedir = screen.getAllByRole('link', { name: /^pedir$/i });
    expect(pedir[0]).toHaveAttribute('href', '/pedir');
    expect(screen.getAllByRole('link', { name: /ya tengo cuenta/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /soy establecimiento/i })[0]).toHaveAttribute(
      'href',
      'https://app.vaiinilla.app',
    );
    expect(screen.getAllByText('Próximamente').length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /app store/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /google play/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^entrar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^panel/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /el menú del lugar/i })).toBeInTheDocument();
    expect(screen.queryByText(/cafetería escolar/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/del campus/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/cualquier negocio de comida/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/pago confirmado/i).length).toBeGreaterThan(0);
  });

  it('Pedir vuelve al último lugar si ya hay uno guardado', async () => {
    rememberPlace('renasci-bar');
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: /^pedir$/i })[0]).toHaveAttribute(
        'href',
        '/e/renasci-bar',
      );
    });
  });
});
