import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/theme-context';
import { clearStripeCheckoutSession } from '../lib/stripe-session';
import { resetPwaUpdateGuardsForTests } from '../lib/pwa-update';
import type { HomeDeliveryQuote } from '../types/api';
import { CartPage } from './cart-page';

const authState: { user: { email: string; displayName: string } | null } = {
  user: { email: 'ana@example.test', displayName: 'Ana' },
};
const buyerSessionState: { context: { access_token: string; contexto: { establecimiento_id: string } } | null } = {
  context: null,
};

const api = vi.hoisted(() => ({
  getEstablishment: vi.fn(),
  getOperationalStatus: vi.fn(),
  getMyWallet: vi.fn(),
  getGuestCatalog: vi.fn(),
  createOrder: vi.fn(),
  listOrders: vi.fn(),
  listReservations: vi.fn(),
  getLegalVersions: vi.fn(),
  quoteHomeDelivery: vi.fn(),
  openClientSession: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    getEstablishment: (...a: unknown[]) => api.getEstablishment(...a) as Promise<unknown>,
    getOperationalStatus: (...a: unknown[]) => api.getOperationalStatus(...a) as Promise<unknown>,
    getMyWallet: (...a: unknown[]) => api.getMyWallet(...a) as Promise<unknown>,
    getGuestCatalog: (...a: unknown[]) => api.getGuestCatalog(...a) as Promise<unknown>,
    createOrder: (...a: unknown[]) => api.createOrder(...a) as Promise<unknown>,
    listOrders: (...a: unknown[]) => api.listOrders(...a) as Promise<unknown>,
    listReservations: (...a: unknown[]) => api.listReservations(...a) as Promise<unknown>,
    getLegalVersions: (...a: unknown[]) => api.getLegalVersions(...a) as Promise<unknown>,
    quoteHomeDelivery: (...a: unknown[]) => api.quoteHomeDelivery(...a) as Promise<unknown>,
    apiUrl: '/api/v1',
  },
}));

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: authState.user, ready: true, configured: true, signOut: vi.fn() }),
}));

vi.mock('../context/buyer-session', () => ({
  useBuyerSessionToken: () => null,
  useBuyerSession: () => ({
    context: buyerSessionState.context,
    opening: false,
    openClientSession: (...a: unknown[]) => api.openClientSession(...a) as Promise<unknown>,
    clearSession: vi.fn(),
  }),
}));

const cartState = {
  cart: null as null | { slug: string; establishmentName: string; lines: unknown[] },
  updateQuantity: vi.fn(),
  removeLine: vi.fn(),
  reset: vi.fn(),
};
vi.mock('../context/cart-context', () => ({ useCart: () => cartState }));

// Leaflet no corre en jsdom: el mapa se reemplaza por uno que "elige" un punto fijo, cotiza
// con la función real del carrito y confirma lo que respondió el back.
vi.mock('../components/home-delivery-map', () => ({
  HomeDeliveryMap: ({
    onQuote,
    onConfirm,
  }: {
    onQuote: (p: { lat: number; lng: number }) => Promise<HomeDeliveryQuote>;
    onConfirm: (pick: { point: { lat: number; lng: number }; address: string; quote: HomeDeliveryQuote }) => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        const point = { lat: 28.6321, lng: -106.0889 };
        void onQuote(point).then((quote) => onConfirm({ point, address: 'Aldama 1408, Centro, Chihuahua', quote }));
      }}
    >
      Mapa de prueba: entregar aquí
    </button>
  ),
}));

const reparteStatus = {
  recibiendo_pedidos: true,
  sesion_caja_abierta: true,
  caja_en_linea: true,
  cocina_en_linea: true,
  reparto: { activo: true, radio_km: '5', costo: '40.00', minimo: '100.00' },
  permite_contra_entrega: true,
  anticipo_porcentaje: null,
  datos_transferencia: null,
};

function renderCart() {
  return render(
    <MemoryRouter initialEntries={['/e/demo-a/carrito']}>
      <ThemeProvider>
        <Routes>
          <Route path="/e/:slug/carrito" element={<CartPage />} />
          <Route path="/cuenta" element={<p>Cuenta login</p>} />
          <Route path="/cuenta/pedidos/:id" element={<p>Pedido creado</p>} />
          <Route path="/cuenta/pedidos" element={<p>Mis pedidos</p>} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('CartPage a domicilio', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    resetPwaUpdateGuardsForTests();
    clearStripeCheckoutSession();
    authState.user = { email: 'ana@example.test', displayName: 'Ana' };
    buyerSessionState.context = { access_token: 'jwt', contexto: { establecimiento_id: '1' } };
    api.getEstablishment.mockResolvedValue({
      id: '1',
      nombre: 'Repostería Demo',
      slug: 'demo-a',
      identificador_cliente_etiqueta: 'Matrícula',
      identificador_cliente_obligatorio: false,
      acepta_tarjeta: true,
      reparto_activo: true,
      latitud: 28.63,
      longitud: -106.08,
    });
    api.getOperationalStatus.mockResolvedValue(reparteStatus);
    api.getMyWallet.mockResolvedValue(null);
    api.getGuestCatalog.mockResolvedValue({ categorias: [], productos: [] });
    api.listOrders.mockResolvedValue({ orders: [] });
    api.listReservations.mockResolvedValue([]);
    api.getLegalVersions.mockResolvedValue(null);
    api.openClientSession.mockResolvedValue({ access_token: 'jwt', contexto: { establecimiento_id: '1' } });
    api.createOrder.mockReset();
    api.quoteHomeDelivery.mockReset().mockResolvedValue({ llega: true, distancia_km: '2.4', costo: '45.00', minimo: '100.00' });
    cartState.cart = {
      slug: 'demo-a',
      establishmentName: 'Repostería Demo',
      lines: [{ productId: 1, quantity: 1, optionIds: [], productName: 'Pastel', unitPreview: '120.00', unitCounter: '120.00', imageUrl: null }],
    };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('con la bandera apagada no ofrece domicilio aunque el negocio reparta', async () => {
    renderCart();
    await waitFor(() => expect(screen.getByRole('button', { name: /^continuar$/i })).toBeEnabled());
    expect(screen.queryByRole('radio', { name: /a domicilio/i })).not.toBeInTheDocument();
  });

  it('con la bandera, un negocio sin reparto no ofrece domicilio', async () => {
    vi.stubEnv('VITE_FEATURE_DOMICILIO', 'true');
    api.getOperationalStatus.mockResolvedValue({ ...reparteStatus, reparto: undefined });
    renderCart();
    await waitFor(() => expect(screen.getByRole('button', { name: /^continuar$/i })).toBeEnabled());
    expect(screen.queryByRole('radio', { name: /a domicilio/i })).not.toBeInTheDocument();
  });

  it('sin cuenta invita a entrar para pedir a domicilio', async () => {
    vi.stubEnv('VITE_FEATURE_DOMICILIO', 'true');
    authState.user = null;
    buyerSessionState.context = null;
    renderCart();
    expect(await screen.findByRole('link', { name: /entra a tu cuenta/i })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /a domicilio/i })).not.toBeInTheDocument();
  });

  it('elige el punto en el mapa, cotiza, suma el envío y crea el pedido a domicilio al recibir', async () => {
    vi.stubEnv('VITE_FEATURE_DOMICILIO', 'true');
    api.createOrder.mockResolvedValue({
      id: 'ord-casa',
      folio: 9,
      estado: 'cobrado',
      metodo_pago: 'efectivo',
      destino: 'a_domicilio',
      qr_token: 'pickup',
      espacio: null,
      total: '165.00',
      items: [],
    });
    const user = userEvent.setup();
    renderCart();

    await user.click(await screen.findByRole('radio', { name: /a domicilio/i }));
    // Sin dirección no se puede seguir.
    expect(screen.getByRole('button', { name: /^continuar$/i })).toBeDisabled();
    expect(screen.getByText(/aún no eliges dónde/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /elegir en el mapa/i }));
    await user.click(screen.getByRole('button', { name: /mapa de prueba/i }));
    expect(await screen.findByText('Aldama 1408, Centro, Chihuahua')).toBeInTheDocument();
    expect(api.quoteHomeDelivery).toHaveBeenCalledWith('jwt', 28.6321, -106.0889);
    expect(screen.getByText(/sí llegamos · 2.4 km/i)).toBeInTheDocument();
    expect(screen.getByText('Envío $45')).toBeInTheDocument();

    // Falta el teléfono.
    expect(screen.getByRole('button', { name: /^continuar$/i })).toBeDisabled();
    await user.type(screen.getByLabelText(/teléfono/i), '614 123 4567');
    await user.type(screen.getByLabelText(/referencia/i), 'Portón negro');
    await waitFor(() => expect(screen.getByRole('button', { name: /^continuar$/i })).toBeEnabled());
    // 120 de productos (pagando al recibir, precio de mostrador) + 45 de envío.
    expect(screen.getAllByText('$165').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /^continuar$/i }));
    // Solo las formas de pago de domicilio: tarjeta y al recibir; sin caja ni saldo.
    expect(await screen.findByRole('radio', { name: /al recibir/i })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /pago en caja/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /saldo vaiinilla/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /al recibir/i }));
    await user.click(screen.getByRole('button', { name: /continuar con pago al recibir/i }));

    await waitFor(() => expect(api.createOrder).toHaveBeenCalledTimes(1));
    const payload = api.createOrder.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).toMatchObject({
      metodo_pago: 'efectivo',
      destino: 'a_domicilio',
      espacio_id: null,
      pago_diferido: false,
      al_recibir: true,
      entrega: {
        direccion: 'Aldama 1408, Centro, Chihuahua',
        telefono: '6141234567',
        referencia: 'Portón negro',
        lat: 28.6321,
        lng: -106.0889,
      },
    });
    expect(payload).not.toHaveProperty('con_anticipo');
    expect(await screen.findByText(/mis pedidos/i)).toBeInTheDocument();
  });

  it('fuera de la zona no deja continuar', async () => {
    vi.stubEnv('VITE_FEATURE_DOMICILIO', 'true');
    api.quoteHomeDelivery.mockResolvedValue({ llega: false, distancia_km: '9.0', costo: '40.00', minimo: null });
    const user = userEvent.setup();
    renderCart();
    await user.click(await screen.findByRole('radio', { name: /a domicilio/i }));
    await user.click(screen.getByRole('button', { name: /elegir en el mapa/i }));
    await user.click(screen.getByRole('button', { name: /mapa de prueba/i }));
    expect(await screen.findByText(/fuera de la zona de entrega \(hasta 5 km\)/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/teléfono/i), '6141234567');
    expect(screen.getByRole('button', { name: /^continuar$/i })).toBeDisabled();
  });
});
