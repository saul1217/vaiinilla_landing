import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/theme-context';
import { GUEST_CHECKOUT_UNAVAILABLE } from '../lib/guest-checkout';
import { CartPage } from './cart-page';

const authState: { user: { email: string; displayName: string } | null } = {
  user: { email: 'ana@example.test', displayName: 'Ana' },
};

const {
  getEstablishment,
  getOperationalStatus,
  getMyWallet,
  createOrder,
  retryStripePayment,
  openClientSession,
} = vi.hoisted(() => ({
  getEstablishment: vi.fn(),
  getOperationalStatus: vi.fn(),
  getMyWallet: vi.fn(),
  createOrder: vi.fn(),
  retryStripePayment: vi.fn(),
  openClientSession: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    getEstablishment: (...args: unknown[]) => getEstablishment(...args) as Promise<unknown>,
    getOperationalStatus: (...args: unknown[]) => getOperationalStatus(...args) as Promise<unknown>,
    getMyWallet: (...args: unknown[]) => getMyWallet(...args) as Promise<unknown>,
    createOrder: (...args: unknown[]) => createOrder(...args) as Promise<unknown>,
    retryStripePayment: (...args: unknown[]) => retryStripePayment(...args) as Promise<unknown>,
    apiUrl: '/api/v1',
  },
}));

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({
    user: authState.user,
    ready: true,
    configured: true,
    signOut: vi.fn(),
  }),
}));

vi.mock('../context/buyer-session', () => ({
  useBuyerSession: () => ({
    context: null,
    opening: false,
    openClientSession: (...args: unknown[]) => openClientSession(...args) as Promise<unknown>,
    clearSession: vi.fn(),
  }),
}));

const cartState = {
  cart: null as null | {
    slug: string;
    establishmentName: string;
    lines: Array<{
      productId: number;
      quantity: number;
      optionIds: number[];
      productName: string;
      unitPreview: string;
      imageUrl: string | null;
    }>;
  },
  updateQuantity: vi.fn(),
  removeLine: vi.fn(),
  reset: vi.fn(),
};

vi.mock('../context/cart-context', () => ({
  useCart: () => cartState,
}));

function renderCart() {
  return render(
    <MemoryRouter initialEntries={['/e/demo-a/carrito']}>
      <ThemeProvider>
        <Routes>
          <Route path="/e/:slug/carrito" element={<CartPage />} />
          <Route path="/cuenta" element={<p>Cuenta login</p>} />
          <Route path="/cuenta/pedidos/:id" element={<p>Pedido creado</p>} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('CartPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    authState.user = { email: 'ana@example.test', displayName: 'Ana' };
    getEstablishment.mockResolvedValue({
      id: '1',
      nombre: 'Cafetería Demo A',
      slug: 'demo-a',
      identificador_cliente_etiqueta: 'Matrícula',
      identificador_cliente_obligatorio: false,
    });
    getOperationalStatus.mockResolvedValue({
      recibiendo_pedidos: true,
      sesion_caja_abierta: true,
      caja_en_linea: true,
      cocina_en_linea: true,
    });
    getMyWallet.mockResolvedValue(null);
    openClientSession.mockResolvedValue({
      access_token: 'jwt',
      contexto: { establecimiento_id: '1' },
    });
    cartState.cart = null;
    createOrder.mockReset();
    retryStripePayment.mockReset();
  });

  it('muestra el vacío ilustrado', async () => {
    renderCart();
    expect(await screen.findByRole('heading', { name: /tu carrito está vacío/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /explorar menú/i })).toHaveAttribute('href', '/e/demo-a');
  });

  it('abre el sheet de pago con efectivo, saldo y tarjeta', async () => {
    cartState.cart = {
      slug: 'demo-a',
      establishmentName: 'Cafetería Demo A',
      lines: [
        {
          productId: 1,
          quantity: 1,
          optionIds: [],
          productName: 'Chocolate $120',
          unitPreview: '120.00',
          imageUrl: null,
        },
      ],
    };
    const user = userEvent.setup();
    renderCart();
    await user.click(await screen.findByRole('button', { name: /^pagar$/i }));
    expect(await screen.findByRole('heading', { name: /cómo quieres pagar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /efectivo al recoger/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /saldo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tarjeta/i })).toBeEnabled();
    expect(screen.getByText(/pagas con stripe/i)).toBeInTheDocument();
  });

  it('crea el pedido Stripe una sola vez y usa el total del backend', async () => {
    cartState.cart = {
      slug: 'demo-a',
      establishmentName: 'Cafetería Demo A',
      lines: [
        {
          productId: 1,
          quantity: 1,
          optionIds: [],
          productName: 'Chocolate',
          unitPreview: '120.00',
          imageUrl: null,
        },
      ],
    };
    createOrder.mockResolvedValue({
      id: 'ord-stripe',
      folio: 7,
      estado: 'por_cobrar',
      metodo_pago: 'stripe',
      destino: 'para_llevar',
      espacio: null,
      total: '123.60',
      items: [],
      pago: {
        payment_attempt_id: 'attempt-1',
        payment_intent_id: 'pi_test_001',
        stripe_account_id: 'acct_test_001',
        payment_status: 'pendiente_pago',
        client_secret: 'pi_test_001_secret_test',
        publishable_key: 'pk_test_51Vaiinilla',
      },
    });
    const user = userEvent.setup();
    renderCart();
    await user.click(await screen.findByRole('button', { name: /^pagar$/i }));
    await user.click(await screen.findByRole('button', { name: /tarjeta/i }));
    await user.click(screen.getByRole('button', { name: /^confirmar$/i }));
    expect(await screen.findByText(/pedido creado/i)).toBeInTheDocument();
    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(retryStripePayment).not.toHaveBeenCalled();
    const payload = createOrder.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.metodo_pago).toBe('stripe');
    expect(payload.items).toEqual([{ producto_id: 1, cantidad: 1, opcion_ids: [] }]);
    expect(JSON.stringify(payload)).not.toContain('"total"');
    expect(createOrder.mock.calls[0]?.[2]).toEqual(expect.any(String));
  });

  it('invitado con comprar-sin-cuenta no va a /cuenta al pagar', async () => {
    authState.user = null;
    sessionStorage.setItem('vaiinilla.buyer.guest-buy.v1', '1');
    sessionStorage.setItem('vaiinilla.buyer.guest-explore.v1', '1');
    cartState.cart = {
      slug: 'demo-a',
      establishmentName: 'Cafetería Demo A',
      lines: [
        {
          productId: 1,
          quantity: 1,
          optionIds: [],
          productName: 'Chocolate',
          unitPreview: '120.00',
          imageUrl: null,
        },
      ],
    };
    const user = userEvent.setup();
    renderCart();
    await user.click(await screen.findByRole('button', { name: /^pagar$/i }));
    expect(screen.queryByText(/cuenta login/i)).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /cómo quieres pagar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /saldo/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /tarjeta/i }));
    await user.click(screen.getByRole('button', { name: /^confirmar$/i }));
    expect(await screen.findByText(GUEST_CHECKOUT_UNAVAILABLE)).toBeInTheDocument();
    expect(screen.queryByText(/cuenta login/i)).not.toBeInTheDocument();
    expect(createOrder).not.toHaveBeenCalled();
  });
});
