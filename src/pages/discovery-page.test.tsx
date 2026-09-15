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
    expect(screen.getByRole('button', { name: /continuar/i })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: /continuar/i }));
    expect(await screen.findByRole('heading', { name: /cafetería demo a/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /usar código/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /abrir menú/i })).toBeInTheDocument();
  });

  it('muestra splash Android si no hay sesión ni exploración de invitado', async () => {
    sessionStorage.clear();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DiscoveryPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: /tu cafetería, sin filas/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /explorar el menú/i }));
    expect(await screen.findByRole('heading', { name: /dónde comes hoy/i })).toBeInTheDocument();
  });
});
