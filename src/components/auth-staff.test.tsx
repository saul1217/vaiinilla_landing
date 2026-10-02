import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionAccess } from '../types/api';
import { AuthScreens } from './auth-screens';

const mocks = vi.hoisted(() => ({
  listAccesses: vi.fn(),
  passwordSignIn: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    getLegalVersions: vi.fn().mockResolvedValue({
      terminos_version: '2026-07',
      privacidad_version: '2026-07',
      terminos_url: 'https://example.test/terminos',
      privacidad_url: 'https://example.test/privacidad',
    }),
    listAccesses: mocks.listAccesses,
    registerIdentity: vi.fn(),
  },
}));

vi.mock('../lib/firebase', () => ({
  passwordSignIn: mocks.passwordSignIn,
  completeTotpSignIn: vi.fn(),
  createPasswordAccount: vi.fn(),
  googleSignIn: vi.fn(),
  sendPasswordReset: vi.fn(),
  firebaseIdToken: vi.fn().mockResolvedValue('token'),
}));

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: null, ready: true, configured: true, signOut: vi.fn() }),
}));

function access(rol: SessionAccess['rol'], nombre = 'Padel prueba'): SessionAccess {
  return {
    membresia_id: `${rol}-1`,
    establecimiento: { id: 'e1', nombre, slug: 'padel' },
    rol,
    identificador_cliente: null,
    estado_establecimiento: 'activo',
    cierre_operativo_disponible: false,
  };
}

async function login() {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/cuenta']}>
      <Routes>
        <Route path="/cuenta" element={<AuthScreens next="/pedir" />} />
        <Route path="/pedir" element={<p>vista de cliente</p>} />
      </Routes>
    </MemoryRouter>,
  );
  await user.click(await screen.findByRole('button', { name: /iniciar sesión/i }));
  await user.type(screen.getByLabelText(/correo/i), 'adriancamargorp3@gmail.com');
  await user.type(screen.getByLabelText(/contraseña/i), 'password1');
  await user.click(screen.getByRole('button', { name: /^entrar$/i }));
  return user;
}

describe('cuenta del equipo en la web de compra', () => {
  beforeEach(() => {
    mocks.listAccesses.mockReset();
    mocks.passwordSignIn.mockReset().mockResolvedValue({ user: { email: 'adriancamargorp3@gmail.com', displayName: 'Adrián' } });
  });

  it('una mesera ve el aviso y no cae directo a la vista de cliente', async () => {
    mocks.listAccesses.mockResolvedValue([access('mesero')]);
    await login();

    expect(await screen.findByRole('heading', { name: /tu cuenta es del equipo/i })).toBeInTheDocument();
    expect(screen.getByText('mesero de Padel prueba')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ir a mi panel/i })).toHaveAttribute('href', 'https://app.vaiinilla.app/acceso');
    expect(screen.getByRole('button', { name: /si quieres entrar como cliente, pica aquí/i })).toBeVisible();
    expect(screen.queryByText('vista de cliente')).toBeNull();
    // Una cuenta ya iniciada no tiene nada que "volver" a hacer en el login.
    expect(screen.queryByRole('button', { name: /^volver$/i })).toBeNull();
  });

  it('"pica aquí" la lleva a la vista de cliente', async () => {
    mocks.listAccesses.mockResolvedValue([access('mesero')]);
    const user = await login();

    await user.click(await screen.findByRole('button', { name: /si quieres entrar como cliente/i }));
    expect(await screen.findByText('vista de cliente')).toBeInTheDocument();
  });

  it('cajero y administrador también ven el aviso, con su rol', async () => {
    mocks.listAccesses.mockResolvedValue([access('cliente'), access('cajero', 'A'), access('admin', 'B')]);
    await login();
    expect(await screen.findByText('cajero de A y administrador de B')).toBeInTheDocument();
  });

  it('un cliente normal entra directo, sin aviso', async () => {
    mocks.listAccesses.mockResolvedValue([access('cliente')]);
    await login();
    expect(await screen.findByText('vista de cliente')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /tu cuenta es del equipo/i })).toBeNull();
  });

  it('una cuenta nueva (sin accesos todavía) entra directo', async () => {
    mocks.listAccesses.mockResolvedValue([]);
    await login();
    expect(await screen.findByText('vista de cliente')).toBeInTheDocument();
  });
});
