import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscoveryPage } from './discovery-page';

const listEstablishments = vi.fn();
const resolveSpace = vi.fn();

vi.mock('../lib/api', () => ({
  api: {
    listEstablishments: (...args: unknown[]) => listEstablishments(...args) as Promise<unknown>,
    resolveSpace: (...args: unknown[]) => resolveSpace(...args) as Promise<unknown>,
    getLegalVersions: vi.fn().mockResolvedValue({
      terminos_version: '2026-07',
      privacidad_version: '2026-07',
      terminos_url: 'https://example.test/terminos',
      privacidad_url: 'https://example.test/privacidad',
    }),
  },
}));

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: null, ready: true, configured: false, signOut: vi.fn() }),
}));

vi.mock('../context/cart-context', () => ({
  useCart: () => ({ cart: null }),
}));

describe('DiscoveryPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('vaiinilla.buyer.guest-explore.v1', '1');
    listEstablishments.mockResolvedValue({
      establishments: [
        {
          id: '1',
          nombre: 'Cafetería Demo A',
          slug: 'demo-a',
          identificador_cliente_etiqueta: 'Matrícula',
          identificador_cliente_obligatorio: true,
          instagram_url: 'https://instagram.com/cafeteria-demo',
        },
      ],
      cursor: null,
    });
  });

  it('lista establecimientos públicos y deja continuar al menú', async () => {
    render(
      <MemoryRouter>
        <DiscoveryPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: /dónde comes hoy/i })).toBeInTheDocument();
    expect(await screen.findByRole('radio', { name: /cafetería demo a/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entrar al menú/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir Instagram' })).toHaveAttribute('href', 'https://instagram.com/cafeteria-demo');
    await userEvent.setup().click(screen.getByRole('button', { name: /entrar al menú/i }));
    expect(await screen.findByRole('heading', { name: /cafetería demo a/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /usar código/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /abrir menú/i })).toBeInTheDocument();
  });

  it('abre el picker de establecimientos sin pedir splash ni cuenta', async () => {
    sessionStorage.clear();
    render(
      <MemoryRouter>
        <DiscoveryPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: /dónde comes hoy/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /tu lugar, a tu ritmo/i })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /^navegación$/i })).toBeInTheDocument();
  });
});
