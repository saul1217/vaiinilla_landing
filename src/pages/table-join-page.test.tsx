import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VaiinillaApiError } from '../lib/api-error';
import { TableJoinPage } from './table-join-page';

const { resolveSpace } = vi.hoisted(() => ({
  resolveSpace: vi.fn(),
}));

const authState: { user: null | { email: string } } = { user: null };

vi.mock('../lib/api', () => ({
  api: { resolveSpace },
}));

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: authState.user, ready: true, configured: false, signOut: vi.fn() }),
}));

vi.mock('../context/cart-context', () => ({
  useCart: () => ({ cart: null }),
}));

function AccessProbe() {
  const location = useLocation();
  return <p>Acceso {location.search}</p>;
}

function renderJoin() {
  return render(
    <MemoryRouter initialEntries={['/demo-a/m/qr-1']}>
      <Routes>
        <Route path="/:slug/m/:token" element={<TableJoinPage />} />
        <Route path="/e/:slug" element={<p>Menú demo-a</p>} />
        <Route path="/cuenta" element={<AccessProbe />} />
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
    expect(screen.getByRole('link', { name: /elegir lugar/i })).toHaveAttribute('href', '/pedir');
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

  it('sin cuenta, el QR primero ofrece entrar o pedir sin cuenta y luego lleva al menú', async () => {
    authState.user = null;
    resolveSpace.mockResolvedValue({
      establecimiento_slug: 'demo-a',
      espacio_id: 3,
      espacio_nombre: 'Mesa 3',
      espacio_tipo: 'mesa',
    });
    renderJoin();
    expect(await screen.findByText('Acceso ?next=%2Fe%2Fdemo-a')).toBeInTheDocument();
    expect(localStorage.getItem('vaiinilla.buyer.space.v1')).toContain('"espacioId":3');
  });

  it('quien ya pidió sin cuenta antes no vuelve a elegir: va directo al menú', async () => {
    authState.user = null;
    localStorage.setItem('vaiinilla.buyer.guest.v1', JSON.stringify({ nombre: 'Ana', llave: 'llave-1' }));
    resolveSpace.mockResolvedValue({
      establecimiento_slug: 'demo-a',
      espacio_id: 3,
      espacio_nombre: 'Mesa 3',
      espacio_tipo: 'mesa',
    });
    renderJoin();
    expect(await screen.findByText('Menú demo-a')).toBeInTheDocument();
  });

  it('registrado con QR válido sigue al menú', async () => {
    authState.user = { email: 'ana@example.test' };
    resolveSpace.mockResolvedValue({
      establecimiento_slug: 'demo-a',
      espacio_id: 3,
      espacio_nombre: 'Mesa 3',
      espacio_tipo: 'mesa',
    });
    renderJoin();
    expect(await screen.findByText('Menú demo-a')).toBeInTheDocument();
    authState.user = null;
  });
});
