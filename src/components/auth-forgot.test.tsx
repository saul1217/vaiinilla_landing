// QA-057: «¿La olvidaste?» pide el correo al backend (marca de Vaiinilla, Resend), nunca a la
// plantilla de Firebase, y el aviso es el mismo exista o no la cuenta.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RATE_LIMIT_MESSAGE, VaiinillaApiError } from '../lib/api-error';
import { AuthScreens } from './auth-screens';

const mocks = vi.hoisted(() => ({
  sendPasswordRecoveryEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    getLegalVersions: vi.fn().mockResolvedValue({
      terminos_version: '2026-07',
      privacidad_version: '2026-07',
      terminos_url: 'https://example.test/terminos',
      privacidad_url: 'https://example.test/privacidad',
    }),
    sendPasswordRecoveryEmail: mocks.sendPasswordRecoveryEmail,
  },
}));

vi.mock('firebase/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('firebase/auth')>()),
  sendPasswordResetEmail: mocks.sendPasswordResetEmail,
}));

vi.mock('../lib/firebase', () => ({
  passwordSignIn: vi.fn(),
  completeTotpSignIn: vi.fn(),
  createPasswordAccount: vi.fn(),
  googleSignIn: vi.fn(),
  firebaseIdToken: vi.fn(),
  refreshEmailVerified: vi.fn(),
}));

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: null, ready: true, configured: true, signOut: vi.fn() }),
}));

const GENERIC_NOTICE = /si la cuenta existe, te enviamos un enlace/i;

async function forgot(email = ' Persona@Example.test ') {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/cuenta']}>
      <Routes>
        <Route path="/cuenta" element={<AuthScreens next="/pedir" />} />
      </Routes>
    </MemoryRouter>,
  );
  await user.click(await screen.findByRole('button', { name: /entrar a mi cuenta/i }));
  await user.type(screen.getByLabelText(/correo/i), email);
  await user.click(screen.getByRole('button', { name: /¿la olvidaste\?/i }));
  return user;
}

describe('recuperar contraseña', () => {
  beforeEach(() => {
    mocks.sendPasswordRecoveryEmail.mockReset().mockResolvedValue(undefined);
    mocks.sendPasswordResetEmail.mockReset();
  });

  it('llama al endpoint del backend con el correo normalizado y nunca al SDK de Firebase', async () => {
    await forgot();
    expect(await screen.findByText(GENERIC_NOTICE)).toBeInTheDocument();
    expect(mocks.sendPasswordRecoveryEmail).toHaveBeenCalledExactlyOnceWith('persona@example.test');
    expect(mocks.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('muestra el mismo aviso aunque la cuenta no exista (el backend responde igual)', async () => {
    mocks.sendPasswordRecoveryEmail.mockResolvedValue(undefined);
    await forgot('nadie@example.test');
    expect(await screen.findByText(GENERIC_NOTICE)).toBeInTheDocument();
    expect(screen.queryByText(/nadie@example\.test/)).not.toBeInTheDocument();
  });

  it('explica en español el límite de intentos (429)', async () => {
    mocks.sendPasswordRecoveryEmail.mockRejectedValue(
      new VaiinillaApiError(429, { code: 'RATE_LIMITED', message: 'Too many requests' }, 30),
    );
    await forgot();
    expect(await screen.findByText(RATE_LIMIT_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(GENERIC_NOTICE)).not.toBeInTheDocument();
  });
});
