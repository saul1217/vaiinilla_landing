import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/theme-context';
import { VaiinillaApiError } from '../lib/api-error';
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
  listReservations,
  createGuest,
  renewGuest,
  getLegalVersions,
  sendVerificationEmail,
} = vi.hoisted(() => ({
  getEstablishment: vi.fn(),
  getOperationalStatus: vi.fn(),
  getMyWallet: vi.fn(),
  getGuestCatalog: vi.fn(),
  createOrder: vi.fn(),
  retryStripePayment: vi.fn(),
  openClientSession: vi.fn(),
  listOrders: vi.fn(),
  listReservations: vi.fn(),
  createGuest: vi.fn(),
  renewGuest: vi.fn(),
  getLegalVersions: vi.fn(),
  sendVerificationEmail: vi.fn(),
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
    listReservations: (...args: unknown[]) => listReservations(...args) as Promise<unknown>,
    createGuest: (...args: unknown[]) => createGuest(...args) as Promise<unknown>,
    renewGuest: (...args: unknown[]) => renewGuest(...args) as Promise<unknown>,
    getLegalVersions: (...args: unknown[]) => getLegalVersions(...args) as Promise<unknown>,
    sendVerificationEmail: (...args: unknown[]) => sendVerificationEmail(...args) as Promise<unknown>,
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

vi.mock('../lib/firebase', () => ({
  firebaseIdToken: vi.fn().mockResolvedValue('firebase-token'),
}));

vi.mock('../context/buyer-session', () => ({
  useBuyerSessionToken: () => null,
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
      unitCounter?: string;
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

function OrdersLanding() {
  const { search } = useLocation();
  return <p>{`Mis pedidos ${search}`}</p>;
}

function renderCart() {
  return render(
    <MemoryRouter initialEntries={['/e/demo-a/carrito']}>
      <ThemeProvider>
        <Routes>
          <Route path="/e/:slug/carrito" element={<CartPage />} />
          <Route path="/cuenta" element={<p>Cuenta login</p>} />
          <Route path="/cuenta/pedidos/:id" element={<p>Pedido creado</p>} />
          <Route path="/cuenta/pedidos" element={<OrdersLanding />} />
          <Route path="/seguimiento/:token" element={<p>Seguimiento del pedido</p>} />
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
    // Negocio con la tarjeta activada por su dueño; una prueba de abajo la apaga.
    getEstablishment.mockResolvedValue({
      id: '1',
      nombre: 'Cafetería Demo A',
      slug: 'demo-a',
      identificador_cliente_etiqueta: 'Matrícula',
      identificador_cliente_obligatorio: false,
      acepta_tarjeta: true,
    });
    getOperationalStatus.mockResolvedValue({
      recibiendo_pedidos: true,
      sesion_caja_abierta: true,
      caja_en_linea: true,
      cocina_en_linea: true,
    });
    getMyWallet.mockResolvedValue(null);
    listReservations.mockResolvedValue([]);
    getLegalVersions.mockResolvedValue({ terminos_version: 't-1', terminos_url: '/terminos', privacidad_version: 'p-1', privacidad_url: '/privacidad' });
    createGuest.mockReset();
    renewGuest.mockReset();
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

  it('con sesión Firebase pide historial real aunque el JWT no esté en memoria', async () => {
    buyerSessionState.context = null;
    listOrders.mockResolvedValue({
      orders: [
        {
          id: 'ord-80',
          folio: 80,
          estado: 'entregado',
          metodo_pago: 'efectivo',
          destino: 'para_llevar',
          total: '16.50',
          items: [{ id: 1, nombre_producto: 'Chicharrones', cantidad: 1, subtotal: '16.50' }],
        },
      ],
    });
    renderCart();
    expect(await screen.findByRole('heading', { name: /pedidos anteriores/i })).toBeInTheDocument();
    expect(openClientSession).toHaveBeenCalled();
    expect(listOrders).toHaveBeenCalledWith('jwt');
    expect(screen.getByText('#80 · Entregado')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /pedidos anteriores/i })).toBeInTheDocument();
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
    expect(document.querySelector('.alumno-antojo__hug')).toHaveAttribute('src', '/vaini/mascot-question.webp');
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

  it('sin la tarjeta activada por el dueño no ofrece pagar con Stripe', async () => {
    getEstablishment.mockResolvedValue({ id: '1', nombre: 'Cafetería Demo A', slug: 'demo-a', acepta_tarjeta: false });
    cartState.cart = {
      slug: 'demo-a',
      establishmentName: 'Cafetería Demo A',
      lines: [{ productId: 1, quantity: 1, optionIds: [], productName: 'Chocolate', unitPreview: '120.00', imageUrl: null }],
    };
    const user = userEvent.setup();
    renderCart();
    await user.click(await screen.findByRole('button', { name: /^pagar$/i }));
    expect(await screen.findByRole('radio', { name: /pago en caja/i })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /pago con stripe/i })).not.toBeInTheDocument();
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
    expect(screen.getByRole('radio', { name: /pago en caja/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /saldo vaiinilla/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /pago con stripe/i })).toBeEnabled();
    expect(screen.getByText(/pago seguro con stripe/i)).toBeInTheDocument();
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
    await user.click(await screen.findByRole('radio', { name: /pago con stripe/i }));
    await user.click(screen.getByRole('button', { name: /^continuar con/i }));
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

  it('logueado sin entregados no fabrica historial ni cards de QA', async () => {
    buyerSessionState.context = {
      access_token: 'jwt',
      contexto: { establecimiento_id: '1' },
    };
    listOrders.mockResolvedValue({ orders: [] });
    renderCart();
    expect(await screen.findByRole('heading', { name: /qué se te antoja/i })).toBeInTheDocument();
    await waitFor(() => expect(listOrders).toHaveBeenCalledWith('jwt'));
    expect(screen.queryByRole('heading', { name: /pedidos anteriores/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/#76/)).not.toBeInTheDocument();
    expect(screen.queryByText(/fruti lupis/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/cargando pedidos anteriores/i)).not.toBeInTheDocument();
  });

  it('distingue carga y error del historial sin cards falsas', async () => {
    buyerSessionState.context = {
      access_token: 'jwt',
      contexto: { establecimiento_id: '1' },
    };
    let resolveOrders: (value: { orders: unknown[] }) => void;
    const pending = new Promise<{ orders: unknown[] }>((resolve) => {
      resolveOrders = resolve;
    });
    listOrders.mockImplementation(() => pending);
    const { unmount } = renderCart();
    expect(await screen.findByRole('status')).toHaveTextContent(/cargando pedidos anteriores/i);
    expect(screen.queryByRole('heading', { name: /pedidos anteriores/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/#76/)).not.toBeInTheDocument();
    resolveOrders!({ orders: [] });
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    unmount();

    listOrders.mockRejectedValue(new Error('No pudimos cargar tus pedidos anteriores.'));
    renderCart();
    expect(await screen.findByText('No pudimos cargar tus pedidos anteriores.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /pedidos anteriores/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/#76/)).not.toBeInTheDocument();
    expect(screen.queryByText(/fruti lupis/i)).not.toBeInTheDocument();
  });

  it('en el vacío de invitado no fabrica pedidos anteriores', async () => {
    authState.user = null;
    listOrders.mockResolvedValue({
      orders: [
        {
          id: 'ord-guest',
          folio: 11,
          estado: 'entregado',
          metodo_pago: 'efectivo',
          destino: 'para_llevar',
          total: '16.50',
          items: [{ id: 1, nombre_producto: 'Chicharrones', cantidad: 1, subtotal: '16.50' }],
        },
      ],
    });
    listOrders.mockClear();
    renderCart();
    expect(await screen.findByRole('heading', { name: /qué se te antoja/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /pedidos anteriores/i })).not.toBeInTheDocument();
    expect(listOrders).not.toHaveBeenCalled();
  });

  it('en el carrito lleno el peek solo muestra lo que no está en el carrito', async () => {
    cartState.cart = {
      slug: 'demo-a',
      establishmentName: 'Cafetería Demo A',
      lines: [
        {
          productId: 10,
          quantity: 1,
          optionIds: [],
          productName: 'Chocolate frío',
          unitPreview: '38.00',
          imageUrl: null,
        },
      ],
    };
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
        {
          id: 11,
          categoria_id: 1,
          estacion_preparacion: 'caja',
          nombre: 'Chicharrones',
          descripcion: null,
          ingredientes: null,
          alergenos: null,
          tiempo_estimado_min: 4,
          precio_mostrador: '16.50',
          precio_digital: '16.50',
          disponible: true,
          imagen_url: null,
          grupos_opcion: [],
        },
      ],
    });
    renderCart();
    expect(await screen.findByRole('heading', { name: /del menú/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /chicharrones/i })).toBeInTheDocument();
    expect(document.querySelectorAll('.alumno-cart-peek__row')).toHaveLength(1);
    expect(document.querySelector('.alumno-cart-peek')).toHaveAttribute('data-peek-count', '1');
    expect(screen.queryByRole('link', { name: /chocolate frío/i })).not.toBeInTheDocument();
  });

  it('si no queda peek, el lleno no fabrica filas ni el idle de canyon', async () => {
    cartState.cart = {
      slug: 'demo-a',
      establishmentName: 'Cafetería Demo A',
      lines: [
        {
          productId: 10,
          quantity: 2,
          optionIds: [],
          productName: 'Chocolate frío',
          unitPreview: '38.00',
          imageUrl: null,
        },
      ],
    };
    renderCart();
    expect(await screen.findByRole('heading', { name: /del menú/i })).toBeInTheDocument();
    expect(document.querySelector('.alumno-cart-peek')).toHaveAttribute('data-peek-count', '0');
    expect(document.querySelector('.alumno-cart-peek__row')).toBeNull();
    expect(document.querySelector('.alumno-cart-peek__art')).toBeNull();
    expect(screen.queryByText(/abre el menú y arma tu pedido/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver todo el menú/i })).toHaveAttribute('href', '/e/demo-a');
  });

  describe('compra sin cuenta', () => {
    const SEGUIMIENTO = 'S'.repeat(43);
    const guestSessionResponse = {
      access_token: 'guest-jwt',
      expires_in: 900,
      contexto: { establecimiento_id: '1', usuario_id: 'u-inv', membresia_id: 'm-inv', rol: 'cliente' },
      invitado: { nombre: 'Lupita', llave: 'L'.repeat(43) },
    };

    beforeEach(() => {
      authState.user = null;
      localStorage.clear();
      getLegalVersions.mockResolvedValue({ terminos_version: 't-1', terminos_url: 'https://vaiinilla.app/terminos', privacidad_version: 'p-1', privacidad_url: 'https://vaiinilla.app/privacidad' });
      createGuest.mockResolvedValue(guestSessionResponse);
      cartState.cart = {
        slug: 'demo-a',
        establishmentName: 'Cafetería Demo A',
        lines: [{ productId: 1, quantity: 2, optionIds: [], productName: 'Chocolate', unitPreview: '120.00', unitCounter: '120.00', imageUrl: null }],
      };
    });

    it('pide solo el nombre, no ofrece saldo y abre Mis pedidos (efectivo)', async () => {
      createOrder.mockResolvedValue({ id: 'ord-g', folio: 21, estado: 'por_cobrar', metodo_pago: 'efectivo', destino: 'para_llevar', qr_token: 'qr', espacio: null, total: '240.00', items: [], invitado: true, seguimiento_token: SEGUIMIENTO });
      const user = userEvent.setup();
      renderCart();

      await user.click(await screen.findByRole('button', { name: /^pagar$/i }));
      expect(screen.queryByText(/cuenta login/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('radio', { name: /saldo vaiinilla/i })).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Términos' })).toHaveAttribute('href', 'https://vaiinilla.app/terminos');
      expect(screen.getByRole('link', { name: 'Aviso de privacidad' })).toBeInTheDocument();
      // Sin nombre no continúa.
      expect(screen.getByRole('button', { name: /^continuar con/i })).toBeDisabled();

      await user.type(screen.getByLabelText('Tu nombre'), 'Lupita');
      await user.click(screen.getByRole('radio', { name: /pago en caja/i }));
      await user.click(screen.getByRole('button', { name: /^continuar con/i }));

      // Igual que un registrado: a Mis pedidos, con el pedido nuevo ya abierto por su token.
      expect(await screen.findByText(`Mis pedidos ?nuevo=${SEGUIMIENTO}`)).toBeInTheDocument();
      expect(createGuest).toHaveBeenCalledWith({ slug: 'demo-a', nombre: 'Lupita', terminosVersion: 't-1', privacidadVersion: 'p-1' });
      expect(createOrder).toHaveBeenCalledWith('guest-jwt', expect.objectContaining({ metodo_pago: 'efectivo' }), expect.any(String));
      // El enlace y la llave quedan en este navegador como respaldo.
      const saved = JSON.parse(localStorage.getItem('vaiinilla.buyer.guest-orders.v1') ?? '[]') as Array<{ token: string; folio: number }>;
      expect(saved[0]).toMatchObject({ token: SEGUIMIENTO, folio: 21 });
      expect(JSON.parse(localStorage.getItem('vaiinilla.buyer.guest.v1') ?? '{}')).toMatchObject({ nombre: 'Lupita' });
    });

    it('sin cuenta no ofrece tarjeta por ahora (solo caja o pagar al final)', async () => {
      const user = userEvent.setup();
      renderCart();
      await user.click(await screen.findByRole('button', { name: /^pagar$/i }));
      expect(screen.queryByRole('radio', { name: /pago con stripe/i })).not.toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /pago en caja/i })).toBeInTheDocument();
    });

    it('con la llave guardada renueva la sesión en vez de dar de alta otra', async () => {
      localStorage.setItem('vaiinilla.buyer.guest.v1', JSON.stringify({ nombre: 'Lupita', llave: 'L'.repeat(43) }));
      renewGuest.mockResolvedValue({ ...guestSessionResponse, invitado: { nombre: 'Lupita' } });
      createOrder.mockResolvedValue({ id: 'ord-g2', folio: 23, estado: 'por_cobrar', metodo_pago: 'efectivo', destino: 'para_llevar', qr_token: 'qr', espacio: null, total: '240.00', items: [], invitado: true, seguimiento_token: SEGUIMIENTO });
      const user = userEvent.setup();
      renderCart();
      await user.click(await screen.findByRole('button', { name: /^pagar$/i }));
      expect(screen.getByLabelText('Tu nombre')).toHaveValue('Lupita');
      await user.click(screen.getByRole('button', { name: /^continuar con/i }));
      expect(await screen.findByText(`Mis pedidos ?nuevo=${SEGUIMIENTO}`)).toBeInTheDocument();
      expect(renewGuest).toHaveBeenCalledWith('demo-a', 'L'.repeat(43));
      expect(createGuest).not.toHaveBeenCalled();
    });

    it('donde se pide con matrícula, sin cuenta no se puede pedir', async () => {
      getEstablishment.mockResolvedValue({ id: '1', nombre: 'Escuela', slug: 'demo-a', identificador_cliente_etiqueta: 'Matrícula', identificador_cliente_obligatorio: true, acepta_tarjeta: true });
      renderCart();
      expect(await screen.findByRole('button', { name: 'Crea tu cuenta para pedir aquí' })).toBeInTheDocument();
    });
  });

  describe('correo sin verificar', () => {
    beforeEach(() => {
      sendVerificationEmail.mockReset().mockResolvedValue({ aceptado: true });
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
    });

    it('al bloquear el pedido ofrece reenviar el correo sin salir del carrito', async () => {
      buyerSessionState.context = { access_token: 'jwt', contexto: { establecimiento_id: '1' } };
      createOrder.mockRejectedValue(
        new VaiinillaApiError(403, { code: 'EMAIL_NOT_VERIFIED', message: 'Verifica tu correo antes de continuar.' }),
      );
      const user = userEvent.setup();
      renderCart();

      await user.click(await screen.findByRole('button', { name: /^pagar$/i }));
      await user.click(screen.getByRole('button', { name: /^continuar con/i }));

      expect(await screen.findAllByText(/verifica tu correo antes de continuar/i)).not.toHaveLength(0);
      await user.click(screen.getByRole('button', { name: /reenviar correo de verificación/i }));

      expect(sendVerificationEmail).toHaveBeenCalledWith('firebase-token');
      expect(await screen.findByText(/revisa tu bandeja/i)).toBeInTheDocument();
    });
  });

  describe('pagar al final', () => {    const line = {
      productId: 1,
      quantity: 1,
      optionIds: [],
      productName: 'Agua',
      unitPreview: '30.00',
      imageUrl: null,
    };

    function setup({ permite, enEspacio }: { permite: boolean; enEspacio: boolean }) {
      buyerSessionState.context = { access_token: 'jwt', contexto: { establecimiento_id: '1' } };
      getOperationalStatus.mockResolvedValue({
        recibiendo_pedidos: true,
        sesion_caja_abierta: true,
        caja_en_linea: true,
        cocina_en_linea: true,
        permite_pago_al_final: permite,
      });
      if (enEspacio) {
        sessionStorage.setItem(
          'vaiinilla.buyer.space.v1',
          JSON.stringify({ slug: 'demo-a', espacioId: 12, nombre: 'Cancha 2', tipo: 'cancha' }),
        );
      }
      cartState.cart = { slug: 'demo-a', establishmentName: 'Cafetería Demo A', lines: [line] };
    }

    it('lo ofrece en un lugar si el negocio lo permite y crea el pedido a la cuenta', async () => {
      setup({ permite: true, enEspacio: true });
      createOrder.mockResolvedValue({ id: 'p9', metodo_pago: 'efectivo', qr_token: null });
      const user = userEvent.setup();
      renderCart();
      expect(await screen.findByText(/en tu cancha/i)).toBeInTheDocument();
      await user.click(await screen.findByRole('button', { name: /^pagar$/i }));
      const option = await screen.findByRole('radio', { name: /pagar al final/i });
      expect(screen.getByText(/paga todo junto al irte de tu cancha/i)).toBeInTheDocument();
      await user.click(option);
      expect(option).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByRole('radio', { name: /pago en caja/i })).toHaveAttribute('aria-checked', 'false');
      await user.click(screen.getByRole('button', { name: /continuar con pagar al final/i }));
      await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));
      const payload = createOrder.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(payload).toMatchObject({
        metodo_pago: 'efectivo',
        destino: 'en_espacio',
        espacio_id: 12,
        pago_diferido: true,
      });
      // Va a Mis pedidos (con el arcade), con el pedido nuevo abierto; no al pedido suelto.
      expect(await screen.findByText('Mis pedidos ?nuevo=p9')).toBeInTheDocument();
      // La mesa sigue: la siguiente ronda no exige volver a escanear y sigue a la cuenta.
      expect(JSON.parse(sessionStorage.getItem('vaiinilla.buyer.space.v1') ?? 'null')).toMatchObject({
        espacioId: 12,
        pagaAlFinal: true,
      });
    });

    it('elegir otra forma de pago quita la cuenta', async () => {
      setup({ permite: true, enEspacio: true });
      createOrder.mockResolvedValue({ id: 'p9', metodo_pago: 'efectivo', qr_token: null });
      const user = userEvent.setup();
      renderCart();
      await user.click(await screen.findByRole('button', { name: /^pagar$/i }));
      await user.click(await screen.findByRole('radio', { name: /pagar al final/i }));
      await user.click(screen.getByRole('radio', { name: /pago en caja/i }));
      await user.click(screen.getByRole('button', { name: /continuar con pago en caja/i }));
      await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));
      expect(createOrder.mock.calls[0]?.[1]).not.toHaveProperty('pago_diferido');
    });

    it('no se ofrece si el negocio no lo permite', async () => {
      setup({ permite: false, enEspacio: true });
      const user = userEvent.setup();
      renderCart();
      await user.click(await screen.findByRole('button', { name: /^pagar$/i }));
      await screen.findByRole('heading', { name: /cómo quieres pagar/i });
      expect(screen.queryByRole('radio', { name: /pagar al final/i })).not.toBeInTheDocument();
    });

    it('no se ofrece en un pedido para llevar', async () => {
      setup({ permite: true, enEspacio: false });
      const user = userEvent.setup();
      renderCart();
      await user.click(await screen.findByRole('button', { name: /^pagar$/i }));
      await screen.findByRole('heading', { name: /cómo quieres pagar/i });
      expect(screen.queryByRole('radio', { name: /pagar al final/i })).not.toBeInTheDocument();
    });
  });

  it('con una cancha rentada y en curso, la comida va a la cancha sin escanear el QR', async () => {
    const now = Date.now();
    listReservations.mockResolvedValue([
      { id: 'r1', courtId: 3, courtName: 'Cancha 1', start: now - 20 * 60_000, end: now + 40 * 60_000, state: 'confirmada' },
    ]);
    cartState.cart = {
      slug: 'demo-a',
      establishmentName: 'Cafetería Demo A',
      lines: [{ productId: 1, quantity: 1, optionIds: [], productName: 'Chocolate', unitPreview: '120.00', imageUrl: null }],
    };
    createOrder.mockResolvedValue({
      id: 'ord-cancha', folio: 8, estado: 'por_cobrar', metodo_pago: 'efectivo', destino: 'en_espacio',
      qr_token: 't', espacio: { id: 3, nombre: 'Cancha 1' }, total: '120.00', items: [], pago: null,
    });
    const user = userEvent.setup();
    renderCart();

    await user.click(await screen.findByRole('button', { name: /^pagar$/i }));
    await waitFor(() => expect(listReservations).toHaveBeenCalledWith('jwt'));
    await user.click(await screen.findByRole('radio', { name: /pago en caja/i }));
    await user.click(screen.getByRole('button', { name: /^continuar con/i }));

    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));
    const payload = createOrder.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.destino).toBe('en_espacio');
    expect(payload.espacio_id).toBe(3);
  });

  it('saldo de $105 alcanza para un pedido de $100 de mostrador aunque con tarjeta cueste $111', async () => {
    getMyWallet.mockResolvedValue({
      wallet: { id: 'w1', usuario_id: 'u1', establecimiento_id: '1', saldo: '105.00', actualizado_en: null },
      movimientos: [],
    });
    cartState.cart = {
      slug: 'demo-a',
      establishmentName: 'Cafetería Demo A',
      lines: [{ productId: 1, quantity: 1, optionIds: [], productName: 'Combo', unitPreview: '111.00', unitCounter: '100.00', imageUrl: null }],
    };
    const user = userEvent.setup();
    renderCart();
    await user.click(await screen.findByRole('button', { name: /^pagar$/i }));
    await user.click(await screen.findByRole('radio', { name: /saldo vaiinilla/i }));

    expect((await screen.findAllByText(/Total \$100(\.00)?$/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/no tienes saldo suficiente/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^continuar con/i })).toBeEnabled();

    await user.click(screen.getByRole('radio', { name: /pago con stripe/i }));
    expect((await screen.findAllByText(/Total \$111(\.00)?$/)).length).toBeGreaterThan(0);
  });
});
