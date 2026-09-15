import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscoveryPage } from './discovery-page';

const listEstablishments = vi.fn();

vi.mock('../lib/api', () => ({
  api: {
    listEstablishments: (...args: unknown[]) => listEstablishments(...args) as Promise<unknown>,
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

  it('lista establecimientos públicos y enlaza al menú', async () => {
    render(
      <MemoryRouter>
        <DiscoveryPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('Cafetería Demo A')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /ver menú/i })).toHaveAttribute('href', '/e/demo-a');
  });
});
