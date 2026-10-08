// "Tus pedidos" sin cuenta: en vivo con la llave del navegador, y el banner de
// enlaces no duplica lo que ya se ve en vivo.
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/theme-context';
import { GuestLiveOrders } from './guest-live-orders';
import { GuestOrdersBanner } from './guest-orders-banner';
import { rememberGuestOrder } from '../lib/guest-orders';
import { useGuestLiveOrders } from '../lib/use-guest-live-orders';
import type { TrackedOrder } from '../types/api';

const authState: { user: null | { email: string } } = { user: null };

const { listGuestOrders } = vi.hoisted(() => ({ listGuestOrders: vi.fn() }));

vi.mock('../lib/api', () => ({
  api: {
    listGuestOrders: (...args: unknown[]) => listGuestOrders(...args) as Promise<unknown>,
    apiUrl: '/api/v1',
  },
}));

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: authState.user, ready: true, configured: true, signOut: vi.fn() }),
}));

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,qr') },
}));

const LLAVE = 'K'.repeat(43);
const TOKEN = 'S'.repeat(43);

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

function Probe({ slug }: { slug: string }) {
  const { orders } = useGuestLiveOrders(slug);
  return (
    <MemoryRouter>
      <ThemeProvider>
        <GuestLiveOrders orders={orders} />
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe('tus pedidos sin cuenta', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    authState.user = null;
    listGuestOrders.mockReset();
  });

  it('con la llave del navegador muestra el pedido en vivo como un registrado', async () => {
    localStorage.setItem('vaiinilla.buyer.guest.v1', JSON.stringify({ nombre: 'Lupita', llave: LLAVE }));
    listGuestOrders.mockResolvedValue([liveOrder()]);
    render(<Probe slug="padel" />);

    expect(listGuestOrders).toHaveBeenCalledWith('padel', LLAVE);
    expect(await screen.findByText('Tus pedidos')).toBeInTheDocument();
    expect(screen.getAllByText('Preparando').length).toBeGreaterThan(0);
    expect(screen.getByText(/1 Torta/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /ver seguimiento/i });
    expect(link.getAttribute('href')).toBe(`/seguimiento/${TOKEN}`);
  });

  it('sobrevive cerrar la pestaña: sin sessionStorage el pedido sigue ahí', async () => {
    localStorage.setItem('vaiinilla.buyer.guest.v1', JSON.stringify({ nombre: 'Lupita', llave: LLAVE }));
    listGuestOrders.mockResolvedValue([liveOrder()]);
    const first = render(<Probe slug="padel" />);
    expect(await first.findByText('Tus pedidos')).toBeInTheDocument();
    first.unmount();

    // Cerrar la pestaña borra la sesión; la llave vive en localStorage.
    sessionStorage.clear();
    expect(sessionStorage.length).toBe(0);
    render(<Probe slug="padel" />);
    expect(await screen.findByText('Tus pedidos')).toBeInTheDocument();
    expect(screen.getAllByText('Preparando').length).toBeGreaterThan(0);
  });

  it('solo filtra los activos: un entregado ya cobrado no estorba', async () => {
    localStorage.setItem('vaiinilla.buyer.guest.v1', JSON.stringify({ nombre: 'Lupita', llave: LLAVE }));
    listGuestOrders.mockResolvedValue([
      liveOrder(),
      liveOrder({ id: 'o-2', folio: 6, estado: 'entregado', seguimiento_token: `T${'S'.repeat(42)}` }),
    ]);
    render(<Probe slug="padel" />);

    await screen.findByText('Tus pedidos');
    expect(screen.getAllByText('Preparando').length).toBeGreaterThan(0);
    expect(screen.queryByText('Entregado')).not.toBeInTheDocument();
  });

  it('un registrado no ve nada de invitado', async () => {
    authState.user = { email: 'ana@example.test' };
    localStorage.setItem('vaiinilla.buyer.guest.v1', JSON.stringify({ nombre: 'Lupita', llave: LLAVE }));
    render(<Probe slug="padel" />);
    await waitFor(() => expect(listGuestOrders).not.toHaveBeenCalled());
    expect(screen.queryByText('Tus pedidos')).not.toBeInTheDocument();
  });

  it('el banner no duplica los enlaces que ya se ven en vivo', () => {
    rememberGuestOrder({
      token: TOKEN,
      slug: 'padel',
      folio: 7,
      placeName: 'Pádel',
      createdAt: Date.now(),
      destination: 'en_espacio',
      sessionId: 'sesion-mesa-1',
    });
    rememberGuestOrder({
      token: 'O'.repeat(43),
      slug: 'padel',
      folio: 6,
      placeName: 'Pádel',
      createdAt: Date.now(),
      destination: 'para_llevar',
    });
    render(
      <MemoryRouter>
        <GuestOrdersBanner slug="padel" excludeTokens={[TOKEN]} />
      </MemoryRouter>,
    );
    expect(screen.queryByText('Tu pedido #7')).not.toBeInTheDocument();
    expect(screen.getByText('Tu pedido #6')).toBeInTheDocument();
  });

  it('recién pedido (?nuevo): esa tarjeta ya llega abierta', async () => {
    localStorage.setItem('vaiinilla.buyer.guest.v1', JSON.stringify({ nombre: 'Lupita', llave: LLAVE }));
    listGuestOrders.mockResolvedValue([liveOrder()]);
    render(
      <MemoryRouter>
        <ThemeProvider>
          <GuestLiveOrders orders={[liveOrder()]} initialExpandedToken={TOKEN} />
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: /ocultar seguimiento/i })).toBeInTheDocument();
  });

  it('sin ?nuevo las tarjetas llegan cerradas', async () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <GuestLiveOrders orders={[liveOrder()]} />
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: /ver seguimiento$/i })).toBeInTheDocument();
  });
});
