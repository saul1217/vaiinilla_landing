// Pedidos del invitado: misma pestaña que un registrado con su llave — pedidos en
// vivo, mesa compartida con alias y enlaces guardados. Sobrevive cerrar la pestaña.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/theme-context';
import type { SharedTable, TrackedOrder } from '../types/api';
import { GuestOrdersPage } from './guest-orders-page';

const authState: { user: null | { email: string } } = { user: null };

const cartState: { cart: { slug: string; establishmentName: string; lines: never[] } | null } = {
  cart: { slug: 'padel', establishmentName: 'Pádel', lines: [] },
};

const {
  getEstablishment,
  getGuestCatalog,
  getLegalVersions,
  listGuestOrders,
  currentTable,
  renewGuest,
  joinTable,
} = vi.hoisted(() => ({
  getEstablishment: vi.fn(),
  getGuestCatalog: vi.fn(),
  getLegalVersions: vi.fn(),
  listGuestOrders: vi.fn(),
  currentTable: vi.fn(),
  renewGuest: vi.fn(),
  joinTable: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    getEstablishment: (...args: unknown[]) => getEstablishment(...args) as Promise<unknown>,
    getGuestCatalog: (...args: unknown[]) => getGuestCatalog(...args) as Promise<unknown>,
    getLegalVersions: (...args: unknown[]) => getLegalVersions(...args) as Promise<unknown>,
    listGuestOrders: (...args: unknown[]) => listGuestOrders(...args) as Promise<unknown>,
    currentTable: (...args: unknown[]) => currentTable(...args) as Promise<unknown>,
    renewGuest: (...args: unknown[]) => renewGuest(...args) as Promise<unknown>,
    joinTable: (...args: unknown[]) => joinTable(...args) as Promise<unknown>,
    apiUrl: '/api/v1',
  },
}));

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: authState.user, ready: true, configured: true, signOut: vi.fn() }),
}));

vi.mock('../context/cart-context', () => ({
  useCart: () => ({ cart: cartState.cart }),
}));

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,qr') },
}));

const LLAVE = 'K'.repeat(43);
const TOKEN = 'S'.repeat(43);

const guestSession = {
  access_token: 'guest-jwt',
  token_type: 'Bearer',
  expires_in: 900,
  contexto: { usuario_id: 'u-inv', membresia_id: 'm-inv', establecimiento_id: 'e-padel', rol: 'cliente' },
  invitado: { nombre: 'Lupi' },
};

function liveOrder(over: Partial<TrackedOrder> = {}): TrackedOrder {
  return {
    id: 'o-1',
    folio: 7,
    fecha_operativa: '2026-10-03',
    estado: 'preparando',
    metodo_pago: 'efectivo',
    destino: 'para_llevar',
    espacio: null,
    subtotal: '60.00',
    ahorro_combinado: '0.00',
    cashback_otorgado: '0.00',
    total: '60.00',
    version: 1,
    creado_en: '2026-10-03T12:00:00Z',
    actualizado_en: '2026-10-03T12:00:00Z',
    notas_cocina: null,
    usuario: null,
    items: [
      {
        id: 1,
        producto_id: 9,
        nombre_producto: 'Torta',
        estacion_preparacion: 'cocina',
        cantidad: 1,
        precio_digital_unitario: '60.00',
        subtotal: '60.00',
        opciones: [],
      },
    ],
    qr_token: null,
    seguimiento_token: TOKEN,
    ...over,
  };
}

function mesa(over: Partial<SharedTable> = {}): SharedTable {
  return {
    espacio: { id: 5, nombre: 'Mesa 5', tipo: 'mesa' },
    mi_alias: 'Lupi',
    cuenta_abierta: true,
    participantes: [
      { alias: 'Lupi', soy_yo: true, unido_en: null },
      { alias: 'Beto', soy_yo: false, unido_en: null },
    ],
    grupos: [
      {
        alias: 'Beto',
        soy_yo: false,
        total: '20.20',
        pagado: '0.00',
        pendiente: '20.20',
        pedidos: [
          { id: null, folio: 8, estado: 'listo', items_resumen: '1× Torta', total: '20.20', pendiente_cobro: false, creado_en: 'b' },
        ],
      },
    ],
    totales: { total: '20.20', pagado: '0.00', pendiente: '20.20' },
    mi_parte: { total: '0.00', pagado: '0.00', pendiente: '0.00' },
    ...over,
  };
}

function renderPage(entry = '/cuenta/pedidos') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ThemeProvider>
        <Routes>
          <Route path="/cuenta/pedidos" element={<GuestOrdersPage />} />
          <Route path="/pedir" element={<p>Elegir lugar</p>} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('pedidos del invitado', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    authState.user = null;
    cartState.cart = { slug: 'padel', establishmentName: 'Pádel', lines: [] };
    localStorage.setItem('vaiinilla.buyer.guest.v1', JSON.stringify({ nombre: 'Lupi', llave: LLAVE }));
    getEstablishment.mockResolvedValue({ id: 'e-padel', nombre: 'Pádel', slug: 'padel' });
    getGuestCatalog.mockResolvedValue({ categorias: [], productos: [] });
    getLegalVersions.mockResolvedValue({
      terminos_version: 't',
      terminos_url: 'https://example.test/terminos',
      privacidad_version: 'p',
      privacidad_url: 'https://example.test/privacidad',
    });
    renewGuest.mockResolvedValue(guestSession);
    listGuestOrders.mockResolvedValue([liveOrder()]);
    currentTable.mockResolvedValue(null);
    joinTable.mockReset();
  });

  it('muestra sus pedidos en vivo con estado y enlace, sin Cartera', async () => {
    renderPage();

    expect(await screen.findByText('Mis pedidos')).toBeInTheDocument();
    expect(screen.getByText('Pádel')).toBeInTheDocument();
    expect(await screen.findByText('Tus pedidos')).toBeInTheDocument();
    expect(screen.getAllByText('Preparando').length).toBeGreaterThan(0);
    const link = screen.getByRole('link', { name: /ver seguimiento/i });
    expect(link.getAttribute('href')).toBe(`/seguimiento/${TOKEN}`);
    expect(listGuestOrders).toHaveBeenCalledWith('padel', LLAVE);
    expect(screen.getByText(/pides como lupi sin cuenta/i)).toBeInTheDocument();
  });

  it('recién pedido (?nuevo=token): ese pedido ya llega abierto', async () => {
    renderPage(`/cuenta/pedidos?nuevo=${TOKEN}`);

    expect(await screen.findByText('Tus pedidos')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /ocultar seguimiento/i })).toBeInTheDocument();
  });

  it('quien escaneó el QR se une a la mesa con su alias', async () => {
    sessionStorage.setItem(
      'vaiinilla.buyer.space.v1',
      JSON.stringify({ slug: 'padel', espacioId: 5, nombre: 'Mesa 5', tipo: 'mesa', qrToken: 'qr-5' }),
    );
    joinTable.mockResolvedValue(mesa());
    const user = userEvent.setup();
    renderPage();

    // El alias viene del nombre del invitado; unirse usa su sesión de llave.
    const alias = await screen.findByRole('textbox', { name: /tu nombre en la mesa/i });
    expect(alias).toHaveValue('Lupi');
    await user.click(screen.getByRole('button', { name: /unirme a la mesa/i }));

    expect(joinTable).toHaveBeenCalledWith('guest-jwt', 'qr-5', 'Lupi');
    expect(await screen.findByRole('article', { name: 'Mesa 5' })).toBeInTheDocument();
    // Dos invitados en la misma mesa: solo alias, cada quien ve al otro.
    expect(screen.getByText('Lupi (tú)')).toBeInTheDocument();
    expect(screen.getAllByText('Beto').length).toBeGreaterThan(0);
    expect(screen.getByText('1× Torta')).toBeInTheDocument();
  });

  it('cerrar y reabrir la pestaña: sigue dentro de la mesa y el espacio se restaura', async () => {
    currentTable.mockResolvedValue(mesa());
    const first = renderPage();
    expect(await first.findByRole('article', { name: 'Mesa 5' })).toBeInTheDocument();
    first.unmount();

    // Cerrar la pestaña borra la sesión (espacio y JWT); la llave queda.
    sessionStorage.clear();
    expect(sessionStorage.length).toBe(0);
    renderPage();

    // La participación vive en el servidor: la mesa se ve sin volver a escanear.
    expect(await screen.findByRole('article', { name: 'Mesa 5' })).toBeInTheDocument();
    // Y el espacio se restaura para que el pedido se ligue igual.
    await waitFor(() => {
      const raw = localStorage.getItem('vaiinilla.buyer.space.v1');
      expect(raw).toContain('"espacioId":5');
    });
  });

  it('sin establecimiento muestra vacío con salida al menú', async () => {
    cartState.cart = null;
    localStorage.clear();
    renderPage();

    expect(await screen.findByText(/aún no hay pedidos/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /elegir lugar/i })).toHaveAttribute('href', '/pedir');
  });
});
