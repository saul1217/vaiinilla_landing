import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VaiinillaApiError } from '../lib/api-error';
import { TableJoinPage } from './table-join-page';

const { resolveSpace } = vi.hoisted(() => ({
  resolveSpace: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: { resolveSpace },
}));

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: null, ready: true, configured: false, signOut: vi.fn() }),
}));

vi.mock('../context/cart-context', () => ({
  useCart: () => ({ cart: null }),
}));

function renderJoin() {
  return render(
    <MemoryRouter initialEntries={['/demo-a/m/bad-token']}>
      <Routes>
        <Route path="/:slug/m/:token" element={<TableJoinPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TableJoinPage', () => {
  beforeEach(() => {
    resolveSpace.mockReset();
  });

  it('muestra error y vuelta a discovery si el código de mesa no existe', async () => {
    resolveSpace.mockRejectedValue(
      new VaiinillaApiError(404, {
        code: 'SPACE_NOT_FOUND',
        message: 'missing',
      }),
    );
    renderJoin();
    expect(await screen.findByText(/no encontramos esa mesa/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /elegir cafetería/i })).toHaveAttribute('href', '/pedir');
  });

  it('explica QR revocado', async () => {
    resolveSpace.mockRejectedValue(
      new VaiinillaApiError(409, {
        code: 'SPACE_TOKEN_REVOKED',
        message: 'revoked',
      }),
    );
    renderJoin();
    expect(await screen.findByText(/ya no sirve/i)).toBeInTheDocument();
  });

  it('explica backend caído', async () => {
    resolveSpace.mockRejectedValue(
      new VaiinillaApiError(0, {
        code: 'BACKEND_UNAVAILABLE',
        message: 'down',
      }),
    );
    renderJoin();
    expect(await screen.findByText(/no está disponible/i)).toBeInTheDocument();
  });
});
