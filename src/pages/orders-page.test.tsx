import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/theme-context';
import { firebaseIdToken } from '../lib/firebase';
import { OrdersPage } from './orders-page';

const authState: { user: { email: string; displayName: string } | null } = {
  user: { email: 'ana@example.test', displayName: 'Ana' },
};

const buyerSessionState: {
  context: { access_token: string; contexto: { establecimiento_id: string } } | null;
} = {
  context: { access_token: 'jwt', contexto: { establecimiento_id: 'e1' } },
};

const cartState = {
  cart: { slug: 'demo-a', establishmentName: 'Demo A', lines: [] } as {
    slug: string;
    establishmentName: string;
    lines: unknown[];
  } | null,
};

const { getEstablishment, listOrders, getOrderQr, getGuestCatalog, listAccesses, openClientSession } =
  vi.hoisted(() => ({
    getEstablishment: vi.fn(),
    listOrders: vi.fn(),
    getOrderQr: vi.fn(),
    getGuestCatalog: vi.fn(),
    listAccesses: vi.fn(),
    openClientSession: vi.fn(),
  }));

vi.mock('../lib/api', () => ({
  api: {
    getEstablishment: (...args: unknown[]) => getEstablishment(...args) as Promise<unknown>,
    listOrders: (...args: unknown[]) => listOrders(...args) as Promise<unknown>,
    getOrderQr: (...args: unknown[]) => getOrderQr(...args) as Promise<unknown>,
    getGuestCatalog: (...args: unknown[]) => getGuestCatalog(...args) as Promise<unknown>,
    listAccesses: (...args: unknown[]) => listAccesses(...args) as Promise<unknown>,
  },
}));

vi.mock('../lib/firebase', () => ({
  firebaseIdToken: vi.fn().mockResolvedValue('firebase-token'),
}));

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({
    user: authState.user,
    ready: true,
    configured: true,
    signOut: vi.fn(),
  }),
}));

vi.mock('../context/cart-context', () => ({
  useCart: () => ({ cart: cartState.cart }),
}));

vi.mock('../context/buyer-session', () => ({
  useBuyerSession: () => ({
    context: buyerSessionState.context,
    opening: false,
    openClientSession,
    clearSession: vi.fn(),
  }),
}));

const liveOrder = {
  id: 'ord-1',
  folio: 42,
  estado: 'preparando',
  metodo_pago: 'efectivo',
  destino: 'para_llevar',
  espacio: null,
  total: '70.00',
  items: [{ id: 1, producto_id: 10, nombre_producto: 'Quiere keke', cantidad: 1, subtotal: '70.00' }],
};

function renderOrders() {
  return render(
    <MemoryRouter initialEntries={['/cuenta/pedidos']}>
      <ThemeProvider>
        <Routes>
          <Route path="/cuenta/pedidos" element={<OrdersPage />} />
          <Route path="/cuenta" element={<p>Cuenta splash</p>} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('OrdersPage', () => {
  beforeEach(() => {
    vi.spyOn(window, 'setInterval').mockReturnValue(0 as unknown as ReturnType<typeof setInterval>);
    vi.mocked(firebaseIdToken).mockResolvedValue('firebase-token');
    sessionStorage.clear();
    localStorage.clear();
    authState.user = { email: 'ana@example.test', displayName: 'Ana' };
    buyerSessionState.context = { access_token: 'jwt', contexto: { establecimiento_id: 'e1' } };
    cartState.cart = { slug: 'demo-a', establishmentName: 'Demo A', lines: [] };
    getEstablishment.mockResolvedValue({
      id: 'e1',
      nombre: 'Cafetería Demo A',
      slug: 'demo-a',
    });
    listOrders.mockResolvedValue({ orders: [liveOrder] });
    getOrderQr.mockRejectedValue(new Error('QR recovery not configured in this test'));
    getGuestCatalog.mockResolvedValue({
      categorias: [],
      productos: [
        {
          id: 10,
          nombre: 'Quiere keke',
          disponible: true,
          imagen_url: 'https://cdn.example/keke.jpg',
          grupos_opcion: [],
        },
      ],
    });
    listAccesses.mockResolvedValue([
      {
        membresia_id: 'm1',
        establecimiento: { id: 'e1', nombre: 'Demo A', slug: 'demo-a' },
        rol: 'cliente',
        identificador_cliente: 'A1',
        estado_establecimiento: 'activo',
        cierre_operativo_disponible: false,
      },
    ]);
    openClientSession.mockResolvedValue({
      access_token: 'jwt',
      contexto: { establecimiento_id: 'e1' },
    });
    listOrders.mockClear();
    listAccesses.mockClear();
  });

  afterEach(() => {
    vi.mocked(window.setInterval).mockRestore();
  });

  it('lista pedidos como tarjetas con folio y estado', async () => {
    renderOrders();
    expect(await screen.findByRole('heading', { name: /mis pedidos/i })).toBeInTheDocument();
    expect(screen.getByText('#42')).toBeInTheDocument();
    expect(screen.getByText(/1 quiere keke/i)).toBeInTheDocument();
    expect(screen.getByText(/para llevar · efectivo/i)).toBeInTheDocument();
    expect(screen.getByText('$70')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ver seguimiento/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(document.querySelector('img.alumno-track-card__thumb')).toHaveAttribute(
        'src',
        'https://cdn.example/keke.jpg',
      );
    });
  });

  it('expande el seguimiento con timeline y pedido completo', async () => {
    const user = userEvent.setup();
    renderOrders();
    await user.click(await screen.findByRole('button', { name: /ver seguimiento/i }));
    expect(screen.getByText(/pago confirmado|por cobrar/i)).toBeInTheDocument();
    expect(document.querySelectorAll('.alumno-timeline li')).toHaveLength(5);
    expect(document.querySelector('.alumno-timeline li.is-current .alumno-timeline__mark')?.textContent).toBe(
      '3',
    );
    expect(document.querySelectorAll('.alumno-timeline li.is-done svg')).toHaveLength(2);
    expect(screen.getByRole('link', { name: /ver pedido completo/i })).toHaveAttribute(
      'href',
      '/cuenta/pedidos/ord-1',
    );
    expect(screen.queryByRole('region', { name: /código de retiro/i })).not.toBeInTheDocument();
    const hide = screen.getByRole('button', { name: /ocultar seguimiento/i });
    expect(hide).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: /ver pedido completo/i });
    expect(cta.compareDocumentPosition(hide) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('invitado nunca llama GET /pedidos', async () => {
    authState.user = null;
    renderOrders();
    expect(await screen.findByText(/cuenta splash/i)).toBeInTheDocument();
    expect(listOrders).not.toHaveBeenCalled();
  });

  it('sin last-place abre contexto por GET /sesiones/accesos', async () => {
    cartState.cart = null;
    buyerSessionState.context = null;
    renderOrders();
    expect(await screen.findByText('#42')).toBeInTheDocument();
    expect(listAccesses).toHaveBeenCalledWith('firebase-token');
    expect(listOrders).toHaveBeenCalledWith('jwt');
  });

  it('vacío real no pinta cards de QA', async () => {
    listOrders.mockResolvedValue({ orders: [] });
    renderOrders();
    expect(await screen.findByText(/aún no hay pedidos en esta sesión/i)).toBeInTheDocument();
    expect(screen.queryByText('#42')).not.toBeInTheDocument();
    expect(screen.queryByText('#93')).not.toBeInTheDocument();
    expect(screen.queryByText('#76')).not.toBeInTheDocument();
    expect(document.querySelector('.alumno-track-card')).toBeNull();
  });

  it('error de pedidos no fabrica historial', async () => {
    listOrders.mockRejectedValue(new Error('No pudimos cargar tus pedidos.'));
    renderOrders();
    expect(await screen.findByText('No pudimos cargar tus pedidos.')).toBeInTheDocument();
    expect(screen.queryByText(/aún no hay pedidos en esta sesión/i)).not.toBeInTheDocument();
    expect(screen.queryByText('#42')).not.toBeInTheDocument();
    expect(document.querySelector('.alumno-track-card')).toBeNull();
  });
});
