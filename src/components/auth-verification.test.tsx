// P0: el correo de verificación se dispara al crear la cuenta (endpoint del
// backend, una sola vez por alta) y el aviso solo existe cuando se disparó.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VaiinillaApiError } from '../lib/api-error';
import { AuthScreens } from './auth-screens';

const mocks = vi.hoisted(() => ({
  listAccesses: vi.fn(),
  registerIdentity: vi.fn(),
  sendVerificationEmail: vi.fn(),
  createPasswordAccount: vi.fn(),
  firebaseIdToken: vi.fn(),
  refreshEmailVerified: vi.fn(),
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
  refreshEmailVerified: mocks.refreshEmailVerified,
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
    mocks.refreshEmailVerified.mockReset().mockResolvedValue(true);
  });

  it('manda el correo primero y da de alta en el backend solo tras verificar', async () => {
    mocks.listAccesses.mockRejectedValue(
      new VaiinillaApiError(401, { code: 'IDENTITY_NOT_REGISTERED', message: 'x' }),
    );
    const user = userEvent.setup();
    renderAuth();
    await signup(user);

    expect(await screen.findByText('Verifica tu correo')).toBeInTheDocument();
    expect(mocks.sendVerificationEmail).toHaveBeenCalledWith('firebase-token');
    expect(mocks.sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('vaiinilla.buyer.verification-sent.v1')).toBe('1');
    expect(mocks.registerIdentity).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Ya verifiqué mi correo' }));
    expect(await screen.findByText('vista de cliente')).toBeInTheDocument();
    expect(mocks.registerIdentity).toHaveBeenCalledTimes(1);
  });

  it('si aún no verifica, no da de alta ni entra', async () => {
    mocks.refreshEmailVerified.mockResolvedValue(false);
    const user = userEvent.setup();
    renderAuth();
    await signup(user);
    await user.click(await screen.findByRole('button', { name: 'Ya verifiqué mi correo' }));

    expect(await screen.findByText(/Aún no vemos tu correo verificado/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/Aún no vemos tu correo verificado/);
    expect(mocks.registerIdentity).not.toHaveBeenCalled();
  });

  it('correo ya registrado: vuelve al paso del correo con opciones y sin texto de Firebase (QA-053)', async () => {
    mocks.createPasswordAccount.mockRejectedValue(
      Object.assign(new Error('Firebase: Error (auth/email-already-in-use).'), {
        code: 'auth/email-already-in-use',
      }),
    );
    const user = userEvent.setup();
    renderAuth();
    await signup(user);

    expect(await screen.findByText(/Este correo ya tiene una cuenta/)).toBeInTheDocument();
    expect(screen.queryByText(/Firebase/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Correo')).toHaveValue('nuevo@example.test');
    expect(screen.getByRole('button', { name: 'Entrar a mi cuenta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recuperar contraseña' })).toBeInTheDocument();
  });

  it('si el envío falla, muestra la pantalla y deja reenviar', async () => {
    mocks.sendVerificationEmail.mockRejectedValueOnce(new Error('Resend caído'));
    const user = userEvent.setup();
    renderAuth();
    await signup(user);

    expect(await screen.findByText(/No pudimos enviar el correo/)).toBeInTheDocument();
    expect(sessionStorage.getItem('vaiinilla.buyer.verification-sent.v1')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Reenviar correo' }));
    expect(mocks.sendVerificationEmail).toHaveBeenCalledTimes(2);
  });
});
