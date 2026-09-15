import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountPage } from './account-page';

const passwordSignIn = vi.fn();
const completeTotpSignIn = vi.fn();

vi.mock('../lib/api', () => ({
  api: {
    getLegalVersions: vi.fn().mockResolvedValue({
      terminos_version: '2026-07',
      privacidad_version: '2026-07',
      terminos_url: 'https://example.test/terminos',
      privacidad_url: 'https://example.test/privacidad',
    }),
    listAccesses: vi.fn().mockResolvedValue([]),
    registerIdentity: vi.fn(),
  },
}));

vi.mock('../lib/firebase', () => ({
  passwordSignIn: (...args: unknown[]) => passwordSignIn(...args) as Promise<unknown>,
  completeTotpSignIn: (...args: unknown[]) => completeTotpSignIn(...args) as Promise<unknown>,
  createPasswordAccount: vi.fn(),
  firebaseIdToken: vi.fn().mockResolvedValue('token'),
}));

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: null, ready: true, configured: true, signOut: vi.fn() }),
}));

vi.mock('../context/cart-context', () => ({
  useCart: () => ({ cart: null }),
}));

describe('AccountPage', () => {
  beforeEach(() => {
    passwordSignIn.mockReset();
    completeTotpSignIn.mockReset();
  });

  it('pide el código TOTP cuando Firebase exige segundo factor', async () => {
    passwordSignIn.mockResolvedValue({
      mfaResolver: { hints: [{ factorId: 'totp', uid: 'hint-1' }] },
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/correo/i), 'jelm060716@gmail.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'password1');
    await user.click(screen.getByRole('button', { name: /^entrar$/i }));

    expect(await screen.findByRole('heading', { name: /verificación/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/código de 6 dígitos/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmar y entrar/i })).toBeInTheDocument();
  });
});
