// P0: el correo de verificación se dispara al crear la cuenta (endpoint del
// backend, una sola vez por alta) y el aviso solo existe cuando se disparó.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthScreens } from './auth-screens';

const mocks = vi.hoisted(() => ({
  listAccesses: vi.fn(),
  registerIdentity: vi.fn(),
  sendVerificationEmail: vi.fn(),
  createPasswordAccount: vi.fn(),
  firebaseIdToken: vi.fn(),
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
    registerIdentity: mocks.registerIdentity,
    sendVerificationEmail: mocks.sendVerificationEmail,
  },
}));

vi.mock('../lib/firebase', () => ({
  passwordSignIn: vi.fn(),
  completeTotpSignIn: vi.fn(),
  createPasswordAccount: mocks.createPasswordAccount,
  googleSignIn: vi.fn(),
  sendPasswordReset: vi.fn(),
  firebaseIdToken: mocks.firebaseIdToken,
}));

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: null, ready: true, configured: true, signOut: vi.fn() }),
}));

function renderAuth() {
  return render(
    <MemoryRouter initialEntries={['/cuenta']}>
      <Routes>
        <Route path="/cuenta" element={<AuthScreens next="/pedir" />} />
        <Route path="/pedir" element={<p>vista de cliente</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function signup(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Crear cuenta con correo' }));
  await user.type(await screen.findByLabelText('Correo'), 'nuevo@example.test');
  await user.click(screen.getByRole('button', { name: 'Continuar' }));
  await user.type(await screen.findByLabelText('Contraseña'), 'password1');
  await user.click(screen.getByRole('button', { name: 'Continuar' }));
  await user.type(await screen.findByLabelText('Nombre'), 'Nuevo');
  await user.click(screen.getByRole('button', { name: 'Continuar' }));
  await user.click(screen.getByRole('switch', { name: /términos/i }));
  await user.click(screen.getByRole('switch', { name: /privacidad/i }));
  await user.click(screen.getByRole('button', { name: /^crear cuenta$/i }));
}

describe('verificación de correo al crear cuenta', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mocks.listAccesses.mockReset().mockResolvedValue([]);
    mocks.registerIdentity.mockReset().mockResolvedValue({});
    mocks.firebaseIdToken.mockReset().mockResolvedValue('firebase-token');
    mocks.createPasswordAccount
      .mockReset()
      .mockResolvedValue({ email: 'nuevo@example.test', emailVerified: false });
    mocks.sendVerificationEmail.mockReset().mockResolvedValue({ aceptado: true });
  });

  it('al crear la cuenta dispara el correo y entra a la app', async () => {
    const user = userEvent.setup();
    renderAuth();
    await signup(user);

    expect(mocks.sendVerificationEmail).toHaveBeenCalledWith('firebase-token');
    expect(mocks.sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('vaiinilla.buyer.verification-sent.v1')).toBe('1');
    expect(await screen.findByText('vista de cliente')).toBeInTheDocument();
  });

  it('si el envío falla, la cuenta igual entra y /cuenta lo reenvía', async () => {
    mocks.sendVerificationEmail.mockRejectedValue(new Error('Resend caído'));
    const user = userEvent.setup();
    renderAuth();
    await signup(user);

    // No bloquea el alta: entra igual y el aviso no se marca como enviado.
    expect(await screen.findByText('vista de cliente')).toBeInTheDocument();
    expect(sessionStorage.getItem('vaiinilla.buyer.verification-sent.v1')).toBeNull();
  });
});
