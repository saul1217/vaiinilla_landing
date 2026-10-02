import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSyncExternalStore } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/theme-context';
import { AccountPage } from './account-page';

// Como Firebase: en cuanto el inicio de sesión resuelve, `user` deja de ser null, ANTES de que la
// web termine de revisar los accesos. Así fue como la mesera cayó directo a la vista de cliente.
const session = vi.hoisted(() => {
  let user: { email: string; displayName: string } | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => user,
    set: (next: typeof user) => {
      user = next;
      listeners.forEach((l) => l());
    },
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
});

const mocks = vi.hoisted(() => ({ listAccesses: vi.fn() }));

vi.mock('../lib/api', () => ({
  api: {
    getLegalVersions: vi.fn().mockResolvedValue({ terminos_version: 'v', privacidad_version: 'v', terminos_url: '#', privacidad_url: '#' }),
    listAccesses: mocks.listAccesses,
    registerIdentity: vi.fn(),
    getEstablishment: vi.fn().mockResolvedValue({ id: 'e1', nombre: 'Padel prueba', slug: 'padel' }),
    getMyWallet: vi.fn().mockResolvedValue({ cliente: { usuario_id: 'u1' }, wallet: { usuario_id: 'u1' }, movimientos: [] }),
  },
}));

vi.mock('../lib/firebase', () => ({
  passwordSignIn: vi.fn(() => {
    const user = { email: 'adriancamargorp3@gmail.com', displayName: 'Adrián' };
    session.set(user);
    return Promise.resolve({ user });
  }),
  completeTotpSignIn: vi.fn(),
  createPasswordAccount: vi.fn(),
  googleSignIn: vi.fn(),
  sendPasswordReset: vi.fn(),
  firebaseIdToken: vi.fn().mockResolvedValue('token'),
}));

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({
    user: useSyncExternalStore(session.subscribe, session.get),
    ready: true,
    configured: true,
    signOut: vi.fn(),
  }),
}));
vi.mock('../context/cart-context', () => ({ useCart: () => ({ cart: null }) }));
vi.mock('../context/buyer-session', () => ({
  useBuyerSessionToken: () => null,
  useBuyerSession: () => ({ context: null, opening: false, openClientSession: vi.fn(), clearSession: vi.fn() }),
}));
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn().mockResolvedValue('data:') } }));

const mesero = {
  membresia_id: 'm1',
  establecimiento: { id: 'e1', nombre: 'Padel prueba', slug: 'padel' },
  rol: 'mesero',
  identificador_cliente: null,
  estado_establecimiento: 'activo',
  cierre_operativo_disponible: false,
};

async function login() {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/cuenta']}>
      <ThemeProvider>
      <Routes>
        <Route path="/cuenta" element={<AccountPage />} />
        <Route path="/pedir" element={<p>vista de cliente</p>} />
      </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );
  await user.click(await screen.findByRole('button', { name: /iniciar sesión/i }));
  await user.type(screen.getByLabelText(/correo/i), 'adriancamargorp3@gmail.com');
  await user.type(screen.getByLabelText(/contraseña/i), 'password1');
  await user.click(screen.getByRole('button', { name: /^entrar$/i }));
  return user;
}

describe('la sesión se activa a mitad del login (como Firebase)', () => {
  beforeEach(() => {
    session.set(null);
    mocks.listAccesses.mockReset();
  });

  it('una mesera sigue viendo el aviso del equipo', async () => {
    mocks.listAccesses.mockResolvedValue([mesero, { ...mesero, membresia_id: 'm2', rol: 'cliente' }]);
    await login();
    expect(await screen.findByText('mesero de Padel prueba')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /si quieres entrar como cliente, pica aquí/i })).toBeVisible();
  });

  it('"pica aquí" la lleva a la vista de cliente', async () => {
    mocks.listAccesses.mockResolvedValue([mesero]);
    const user = await login();
    await user.click(await screen.findByRole('button', { name: /si quieres entrar como cliente/i }));
    expect(await screen.findByText('vista de cliente')).toBeInTheDocument();
  });

  it('un cliente entra directo a la vista de cliente', async () => {
    mocks.listAccesses.mockResolvedValue([{ ...mesero, rol: 'cliente' }]);
    await login();
    expect(await screen.findByText('vista de cliente')).toBeInTheDocument();
  });
});
