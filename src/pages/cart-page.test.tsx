import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/theme-context';
import { GUEST_CHECKOUT_UNAVAILABLE } from '../lib/guest-checkout';
import { QA_PHOTO_TACOS } from '../lib/qa-catalog-photos';
import { CartPage } from './cart-page';

const authState: { user: { email: string; displayName: string } | null } = {
  user: { email: 'ana@example.test', displayName: 'Ana' },
};

const buyerSessionState: {
  context: { access_token: string; contexto: { establecimiento_id: string } } | null;
} = {
  context: null,
};

const {
  getEstablishment,
  getOperationalStatus,
  getMyWallet,
  getGuestCatalog,
  createOrder,
  retryStripePayment,
  openClientSession,
  listOrders,
} = vi.hoisted(() => ({
  getEstablishment: vi.fn(),
  getOperationalStatus: vi.fn(),
  getMyWallet: vi.fn(),
  getGuestCatalog: vi.fn(),
  createOrder: vi.fn(),
  retryStripePayment: vi.fn(),
  openClientSession: vi.fn(),
  listOrders: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    getEstablishment: (...args: unknown[]) => getEstablishment(...args) as Promise<unknown>,
    getOperationalStatus: (...args: unknown[]) => getOperationalStatus(...args) as Promise<unknown>,
    getMyWallet: (...args: unknown[]) => getMyWallet(...args) as Promise<unknown>,
    getGuestCatalog: (...args: unknown[]) => getGuestCatalog(...args) as Promise<unknown>,
    createOrder: (...args: unknown[]) => createOrder(...args) as Promise<unknown>,
    retryStripePayment: (...args: unknown[]) => retryStripePayment(...args) as Promise<unknown>,
    listOrders: (...args: unknown[]) => listOrders(...args) as Promise<unknown>,
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
    context: buyerSessionState.context,
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
    localStorage.clear();
    authState.user = { email: 'ana@example.test', displayName: 'Ana' };
    buyerSessionState.context = null;
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
    listOrders.mockResolvedValue({ orders: [] });
    getGuestCatalog.mockResolvedValue({
      categorias: [],
      productos: [
        {
          id: 10,
          categoria_id: 1,
          estacion_preparacion: 'caja',
          nombre: 'Chocolate frío',
          descripcion: null,
          ingredientes: null,
          alergenos: null,
          tiempo_estimado_min: 4,
          precio_mostrador: '40.00',
          precio_digital: '38.00',
          disponible: true,
          imagen_url: null,
          grupos_opcion: [],
        },
      ],
    });
  });

  it('muestra el vacío ilustrado', async () => {
    renderCart();
    expect(await screen.findByRole('heading', { name: /qué se te antoja/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^ver menú$/i })).toHaveAttribute('href', '/e/demo-a');
    expect(await screen.findByRole('heading', { name: /del menú/i })).toBeInTheDocument();
    expect(screen.getByText('Chocolate frío')).toBeInTheDocument();
  });

  it('lista pedidos anteriores compactos en el carrito vacío', async () => {
    buyerSessionState.context = {
      access_token: 'jwt',
      contexto: { establecimiento_id: '1' },
    };
    listOrders.mockResolvedValue({
      orders: [
        {
          id: 'ord-76',
          folio: 76,
          estado: 'entregado',
          metodo_pago: 'efectivo',
          destino: 'para_llevar',
          total: '22.00',
          items: [{ id: 1, nombre_producto: 'fruti Lupis', cantidad: 1, subtotal: '22.00' }],
        },
      ],
    });
    renderCart();
    expect(await screen.findByRole('heading', { name: /pedidos anteriores/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /fruti lupis/i })).toHaveAttribute('href', '/cuenta/pedidos/ord-76');
    expect(screen.getByText('#76 · Entregado')).toBeInTheDocument();
    expect(screen.getByText('$22')).toBeInTheDocument();
    expect(document.querySelector('.alumno-history-row img')).toBeNull();
    expect(document.querySelector('.alumno-history-row__thumb')).toBeNull();
    expect(document.querySelector('.alumno-antojo__hug')).toHaveAttribute('src', '/vaini/cutout-hug-question.png');
    expect(document.querySelector('.alumno-antojo__q-face')).toBeNull();
    expect(document.querySelector('.alumno-antojo__vaini')).toBeNull();
  });

  it('muestra la foto del catálogo en peek, no en pedidos anteriores', async () => {
    buyerSessionState.context = {
      access_token: 'jwt',
      contexto: { establecimiento_id: '1' },
    };
    getGuestCatalog.mockResolvedValue({
      categorias: [],
      productos: [
        {
          id: 22,
          categoria_id: 1,
          estacion_preparacion: 'cocina',
          nombre: 'Tacos de Cochinita Pibil',
          descripcion: null,
          ingredientes: null,
          alergenos: null,
          tiempo_estimado_min: 4,
          precio_mostrador: '99.00',
          precio_digital: '99.00',
          disponible: true,
          imagen_url: QA_PHOTO_TACOS,
          grupos_opcion: [],
        },
      ],
    });
    listOrders.mockResolvedValue({
      orders: [
        {
          id: 'ord-22',
          folio: 22,
          estado: 'entregado',
          metodo_pago: 'efectivo',
          destino: 'para_llevar',
          total: '99.00',
          items: [{ id: 1, producto_id: 22, nombre_producto: 'Tacos de Cochinita Pibil', cantidad: 1, subtotal: '99.00' }],
        },
      ],
    });
    renderCart();
    expect(await screen.findByRole('heading', { name: /pedidos anteriores/i })).toBeInTheDocument();
    expect(document.querySelector('.alumno-history-row img')).toBeNull();
    expect(document.querySelector('.alumno-cart-peek__row > img')).toHaveAttribute('src', QA_PHOTO_TACOS);
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
    expect(await screen.findByRole('button', { name: /^pagar$/i })).toBeInTheDocument();
    expect(document.querySelector('.alumno-line__thumb--vaini img')).toHaveAttribute(
      'src',
      '/vaini/cutout-frente.png',
    );
    expect(screen.getByText('$120 c/u')).toBeInTheDocument();
    expect(screen.getByText('Total $120')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^pagar$/i }));
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
      qr_token: 'pickup-token',
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
    expect(localStorage.getItem('vaiinilla.buyer.pickup-qr.v1.ord-stripe')).toBe('pickup-token');
  });

  it('espera la validación operativa sin mostrar un error transitorio', async () => {
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
    buyerSessionState.context = {
      access_token: 'jwt',
      contexto: { establecimiento_id: '1' },
    };
    let resolveStatus: (value: unknown) => void;
    getOperationalStatus.mockReturnValue(
      new Promise((resolve) => {
        resolveStatus = resolve;
      }),
    );

    renderCart();

    await waitFor(() => expect(getOperationalStatus).toHaveBeenCalledWith('jwt'));
    expect(screen.queryByText(/no pudimos verificar si el establecimiento/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verificando/i })).toBeDisabled();

    resolveStatus!({
      recibiendo_pedidos: true,
      sesion_caja_abierta: true,
      caja_en_linea: true,
      cocina_en_linea: true,
    });

    expect(await screen.findByRole('button', { name: /^pagar$/i })).toBeEnabled();
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
