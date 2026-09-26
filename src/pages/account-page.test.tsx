import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/theme-context';
import { AccountPage } from './account-page';

const passwordSignIn = vi.fn();
const completeTotpSignIn = vi.fn();
const authState: { user: { email: string; displayName: string } | null } = { user: null };

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
    getEstablishment: vi.fn().mockResolvedValue({
      id: 'e1',
      nombre: 'Demo A',
      slug: 'demo-a',
      identificador_cliente_etiqueta: 'Cliente',
      identificador_cliente_obligatorio: false,
    }),
    getMyWallet: vi.fn().mockResolvedValue({
      cliente: { usuario_id: 'u1', nombre: 'Ana Pérez', identificador_cliente: 'A01234' },
      wallet: { id: 'w1', usuario_id: 'u1', establecimiento_id: 'e1', saldo: '10.00', actualizado_en: null },
      movimientos: [],
    }),
    deleteIdentity: vi.fn(),
  },
}));

vi.mock('../lib/firebase', () => ({
  passwordSignIn: (...args: unknown[]) => passwordSignIn(...args) as Promise<unknown>,
  completeTotpSignIn: (...args: unknown[]) => completeTotpSignIn(...args) as Promise<unknown>,
  createPasswordAccount: vi.fn(),
  googleSignIn: vi.fn(),
  sendPasswordReset: vi.fn(),
  firebaseIdToken: vi.fn().mockResolvedValue('token'),
}));

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: authState.user, ready: true, configured: true, signOut: vi.fn() }),
}));

vi.mock('../context/cart-context', () => ({
  useCart: () => ({ cart: { slug: 'demo-a', establishmentName: 'Demo A', lines: [] } }),
}));

vi.mock('../context/buyer-session', () => ({
  useBuyerSession: () => ({
    context: { access_token: 'jwt', contexto: { establecimiento_id: 'e1' } },
    opening: false,
    openClientSession: vi.fn(),
    clearSession: vi.fn(),
  }),
}));

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,qr') },
}));

describe('AccountPage', () => {
  beforeEach(() => {
    authState.user = null;
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

    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));
    expect(screen.getByRole('button', { name: /^volver$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^inicia sesión$/i })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/correo/i), 'jelm060716@gmail.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'password1');
    await user.click(screen.getByRole('button', { name: /^entrar$/i }));

    expect(await screen.findByRole('heading', { name: /verificación/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/código de 6 dígitos/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmar y entrar/i })).toBeInTheDocument();
  });

  it('muestra configuración con QR, temas, salir y eliminar cuenta', async () => {
    authState.user = { email: 'ana@example.test', displayName: 'Ana Pérez' };
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AccountPage />
        </ThemeProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: /configuración/i })).toBeInTheDocument();
    expect(await screen.findByAltText(/código qr para recargar saldo en caja/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sistema/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /claro/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /oscuro/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /amoled/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cambiar tienda/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^salir$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /eliminar cuenta/i })).toBeInTheDocument();
  });

  it('alta pide un dato por pantalla y solo avanza con datos válidos', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));
    expect(screen.getByRole('heading', { name: /cuál es tu correo/i })).toBeInTheDocument();
    const next = () => screen.getByRole('button', { name: /^continuar$/i });
    expect(next()).toBeDisabled();
    await user.type(screen.getByLabelText('Correo'), 'ana@escuela');
    expect(next()).toBeDisabled();
    await user.type(screen.getByLabelText('Correo'), '.mx');
    await user.click(next());

    expect(screen.getByRole('heading', { name: /crea una contraseña/i })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Contraseña'), 'corta');
    expect(next()).toBeDisabled();
    await user.type(screen.getByLabelText('Contraseña'), '1234');
    await user.click(next());

    expect(screen.getByRole('heading', { name: /cómo te llamas/i })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Nombre'), 'Ana');
    await user.click(next());

    expect(screen.getByRole('heading', { name: /último paso/i })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /términos/i })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /privacidad/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^crear cuenta$/i })).toBeDisabled();

    for (let i = 0; i < 4; i += 1) {
      await user.click(screen.getByRole('button', { name: /^(atrás|cerrar)$/i }));
    }
    expect(screen.getByRole('heading', { name: /tu lugar, a tu ritmo/i })).toBeInTheDocument();
  });

  it('splash ofrece comprar sin cuenta junto a los logins', async () => {
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: /tu lugar, a tu ritmo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear cuenta/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continuar con google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /comprar sin cuenta/i })).toBeInTheDocument();
  });
});
