import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { TableJoinPage } from './table-join-page';

vi.mock('../lib/api', () => ({
  api: {
    resolveSpace: vi.fn().mockRejectedValue(new Error('No encontramos esa mesa. Revisa el código e inténtalo de nuevo.')),
  },
}));

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: null, ready: true, configured: false, signOut: vi.fn() }),
}));

vi.mock('../context/cart-context', () => ({
  useCart: () => ({ cart: null }),
}));

describe('TableJoinPage', () => {
  it('muestra error y vuelta a discovery si el código de mesa no existe', async () => {
    render(
      <MemoryRouter initialEntries={['/demo-a/m/bad-token']}>
        <Routes>
          <Route path="/:slug/m/:token" element={<TableJoinPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/no encontramos esa mesa/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /elegir cafetería/i })).toHaveAttribute('href', '/pedir');
  });
});
