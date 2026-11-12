import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, type ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/theme-context';
import { AppRoutes } from '../app/router';
import { WalletReloadPage } from './wallet-reload-page';

const authState: { user: { uid: string; email: string; displayName: string } | null } = {
  user: { uid: 'u1', email: 'ana@example.test', displayName: 'Ana Pérez' },
};

const mocks = vi.hoisted(() => ({
  getMyWallet: vi.fn(),
  getEstablishment: vi.fn(),
  startCardReload: vi.fn(),
  getCardReload: vi.fn(),
  confirmPayment: vi.fn(),
  loadStripe: vi.fn(),
  testMode: { value: true },
}));

vi.mock('../lib/api', () => ({
  api: {
    apiUrl: '/api/v1',
    getMyWallet: (...args: unknown[]) => mocks.getMyWallet(...args) as Promise<unknown>,
    getEstablishment: (...args: unknown[]) => mocks.getEstablishment(...args) as Promise<unknown>,
    startCardReload: (...args: unknown[]) => mocks.startCardReload(...args) as Promise<unknown>,
    getCardReload: (...args: unknown[]) => mocks.getCardReload(...args) as Promise<unknown>,
  },
}));

vi.mock('../lib/wallet-reload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/wallet-reload')>();
  return { ...actual, isCardReloadTestMode: () => mocks.testMode.value };
});

vi.mock('../lib/client-session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/client-session')>()),
  resolveClientSession: vi.fn().mockResolvedValue({
    context: { access_token: 'jwt' },
    slug: 'demo-a',
    place: null,
  }),
}));

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: authState.user, ready: true, configured: true, signOut: vi.fn() }),
}));

vi.mock('../context/cart-context', () => ({
  useCart: () => ({ cart: { slug: 'demo-a', establishmentName: 'Demo A', lines: [] } }),
}));

vi.mock('../context/buyer-session', () => ({
  useBuyerSessionToken: () => null,
  useBuyerSession: () => ({ context: null, opening: false, openClientSession: vi.fn(), clearSession: vi.fn() }),
}));

vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,qr') } }));

vi.mock('@stripe/stripe-js/pure', () => ({
  loadStripe: (...args: unknown[]) => mocks.loadStripe(...args) as unknown,
}));

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PaymentElement: ({ onReady }: { onReady?: () => void }) => {
    useEffect(() => onReady?.(), [onReady]);
    return <div data-testid="stripe-payment-element" />;
  },
  useStripe: () => ({ confirmPayment: mocks.confirmPayment }),
  useElements: () => ({ getElement: () => ({}) }),
}));

function wallet(saldo: string, extra: Record<string, unknown> = {}) {
  return {
    cliente: { usuario_id: 'u1', nombre: 'Ana Pérez', identificador_cliente: null },
    wallet: { id: 'w1', usuario_id: 'u1', establecimiento_id: 'e1', saldo, actualizado_en: null, saldo_congelado: false },
    movimientos: [],
    recarga_tarjeta: { minima: '50.00', maxima: '2000.00' },
    ...extra,
  };
}

const checkout = {
  recarga: { id: 'r1', usuario_id: 'u1', monto: '200.00', total_cobrado_cents: 21050, estado: 'pendiente_pago', creado_en: 'x' },
  pago: {
    payment_intent_id: 'pi_1',
    stripe_account_id: 'acct_1',
    payment_status: 'pendiente_pago',
    currency: 'mxn',
    amount_cents: 21050,
    application_fee_cents: 600,
    client_secret: 'pi_1_secret',
    publishable_key: 'pk_test_1',
  },
};

function renderPage(path = '/cuenta/saldo/recargar', props: { pollMs?: number; cardPollMs?: number } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <Routes>
          <Route path="/cuenta/saldo/recargar" element={<WalletReloadPage {...props} />} />
          <Route path="/cuenta" element={<p>Cuenta splash</p>} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('WalletReloadPage', () => {
  beforeEach(() => {
    authState.user = { uid: 'u1', email: 'ana@example.test', displayName: 'Ana Pérez' };
    mocks.testMode.value = true;
    mocks.getMyWallet.mockReset().mockResolvedValue(wallet('10.00'));
    mocks.getEstablishment.mockReset().mockResolvedValue({ id: 'e1', nombre: 'Demo A', slug: 'demo-a', acepta_tarjeta: true, permite_saldo: true });
    mocks.startCardReload.mockReset().mockResolvedValue(checkout);
    mocks.getCardReload.mockReset().mockResolvedValue({ ...checkout.recarga, estado: 'acreditada' });
    mocks.confirmPayment.mockReset().mockResolvedValue({});
    mocks.loadStripe.mockReset().mockResolvedValue({});
  });

  it('sin sesión manda a entrar', async () => {
    authState.user = null;
    renderPage();
    expect(await screen.findByText('Cuenta splash')).toBeInTheDocument();
    expect(mocks.getMyWallet).not.toHaveBeenCalled();
  });

  it('en Caja muestra el QR y avisa solo cuando Caja recarga', async () => {
    renderPage('/cuenta/saldo/recargar', { pollMs: 20 });
    expect(await screen.findByTestId('wallet-reload-balance')).toHaveTextContent('$10.00');
    expect(screen.getByRole('heading', { name: 'Recargar en Caja' })).toBeInTheDocument();
    expect(await screen.findByAltText('Código para identificar tu saldo')).toBeInTheDocument();
    mocks.getMyWallet.mockResolvedValue(wallet('110.00'));
    expect(await screen.findByText('Listo, Caja te recargó $100')).toBeInTheDocument();
  });

  it('con tarjeta: monto, comisión, Stripe y el backend confirma', async () => {
    const user = userEvent.setup();
    renderPage('/cuenta/saldo/recargar', { cardPollMs: 1 });
    await user.click(await screen.findByRole('tab', { name: 'Con tarjeta' }));
    const pay = screen.getByRole('button', { name: 'Recargar' });
    expect(pay).toBeDisabled();
    await user.type(screen.getByLabelText('Otro monto'), '20');
    expect(screen.getByText('La recarga debe ser de $50.00 a $2000.00.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '$200' }));
    await user.click(screen.getByRole('button', { name: 'Recargar $200' }));
    expect(mocks.startCardReload).toHaveBeenCalledWith('jwt', '200.00', expect.any(String));
    expect(await screen.findByText('Revisa tu recarga')).toBeInTheDocument();
    expect(screen.getByText('$10.50')).toBeInTheDocument();
    expect(screen.getByText('$210.50')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Seguir al pago' }));
    expect(mocks.loadStripe).toHaveBeenCalledWith('pk_test_1', { stripeAccount: 'acct_1' });
    await user.click(await screen.findByRole('button', { name: 'Pagar ahora' }));
    expect(mocks.confirmPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        redirect: 'if_required',
        confirmParams: { return_url: expect.stringContaining('/cuenta/saldo/recargar?recarga=r1') as unknown },
      }),
    );
    expect(await screen.findByText('Listo, entraron $200 a tu saldo')).toBeInTheDocument();
    expect(mocks.getCardReload).toHaveBeenCalledWith('jwt', 'r1');
  });

  it('una clave live nunca abre Stripe', async () => {
    const user = userEvent.setup();
    mocks.startCardReload.mockResolvedValue({
      ...checkout,
      recarga: { ...checkout.recarga, total_cobrado_cents: 20000 },
      pago: { ...checkout.pago, publishable_key: 'pk_live_1' },
    });
    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Con tarjeta' }));
    await user.click(screen.getByRole('button', { name: '$200' }));
    await user.click(screen.getByRole('button', { name: 'Recargar $200' }));
    expect(await screen.findByText('La recarga con tarjeta solo está disponible en modo de prueba.')).toBeInTheDocument();
    expect(mocks.loadStripe).not.toHaveBeenCalled();
  });

  it('si el banco rechaza, no se cargó nada', async () => {
    mocks.getCardReload.mockResolvedValue({ ...checkout.recarga, estado: 'fallida' });
    renderPage('/cuenta/saldo/recargar?recarga=r1', { cardPollMs: 1 });
    expect(await screen.findByText('El banco no aprobó el cobro. No se cargó nada.')).toBeInTheDocument();
  });

  it('al volver de 3D Secure retoma la recarga', async () => {
    renderPage('/cuenta/saldo/recargar?recarga=r1', { cardPollMs: 1 });
    expect(await screen.findByText('Listo, entraron $200 a tu saldo')).toBeInTheDocument();
    expect(mocks.getCardReload).toHaveBeenCalledWith('jwt', 'r1');
    expect(mocks.startCardReload).not.toHaveBeenCalled();
  });

  it('fuera de modo de prueba solo ofrece Caja', async () => {
    mocks.testMode.value = false;
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Recargar en Caja' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Con tarjeta' })).not.toBeInTheDocument();
  });

  it('si el negocio no acepta tarjeta, solo Caja', async () => {
    mocks.getEstablishment.mockResolvedValue({ id: 'e1', nombre: 'Demo A', slug: 'demo-a', acepta_tarjeta: false });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Recargar en Caja' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Con tarjeta' })).not.toBeInTheDocument();
  });

  it('con el saldo congelado no deja recargar', async () => {
    mocks.getMyWallet.mockResolvedValue(
      wallet('10.00', {
        wallet: { id: 'w1', usuario_id: 'u1', establecimiento_id: 'e1', saldo: '10.00', actualizado_en: null, saldo_congelado: true },
      }),
    );
    renderPage();
    expect(await screen.findByRole('note')).toHaveTextContent(/congelado/);
    expect(screen.queryByRole('heading', { name: 'Recargar en Caja' })).not.toBeInTheDocument();
  });
});

describe('bandera VITE_FEATURE_CARTERA', () => {
  beforeEach(() => {
    mocks.getMyWallet.mockReset().mockResolvedValue(wallet('10.00'));
    mocks.getEstablishment.mockReset().mockResolvedValue({ id: 'e1', nombre: 'Demo A', slug: 'demo-a' });
  });

  it('apagada, la ruta de recarga no existe', async () => {
    render(
      <MemoryRouter initialEntries={['/cuenta/saldo/recargar']}>
        <ThemeProvider>
          <AppRoutes walletReload={false} />
        </ThemeProvider>
      </MemoryRouter>,
    );
    await act(async () => {});
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Recargar saldo' })).not.toBeInTheDocument());
    expect(mocks.getMyWallet).not.toHaveBeenCalled();
  });

  it('prendida, la ruta abre la recarga', async () => {
    render(
      <MemoryRouter initialEntries={['/cuenta/saldo/recargar']}>
        <ThemeProvider>
          <AppRoutes walletReload />
        </ThemeProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Recargar saldo' })).toBeInTheDocument();
  });

  it('el valor por defecto es apagado', async () => {
    const { SHOW_WALLET_RELOAD, SHOW_WALLET, parseFeatureFlag } = await import('../lib/features');
    expect(SHOW_WALLET_RELOAD).toBe(false);
    expect(SHOW_WALLET).toBe(false);
    expect(parseFeatureFlag('true')).toBe(true);
    expect(parseFeatureFlag(' TRUE ')).toBe(true);
    expect(parseFeatureFlag('1')).toBe(false);
    expect(parseFeatureFlag(undefined)).toBe(false);
  });
});
