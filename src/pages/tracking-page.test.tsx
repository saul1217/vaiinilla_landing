import { VaiinillaApiError } from '../lib/api-error';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/theme-context';
import { rememberGuestOrder } from '../lib/guest-orders';
import type { SharedTable, TrackedOrder } from '../types/api';
import { TrackingPage } from './tracking-page';

const { getTracking, currentTable, guestAccessToken, guestSpaceSlug } = vi.hoisted(() => ({
  getTracking: vi.fn(),
  currentTable: vi.fn(),
  guestAccessToken: vi.fn(() => null as string | null),
  guestSpaceSlug: vi.fn(),
}));
vi.mock('../lib/api', () => ({
  api: {
    getTracking: (...a: unknown[]) => getTracking(...a) as Promise<unknown>,
    currentTable: (...a: unknown[]) => currentTable(...a) as Promise<unknown>,
  },
}));
vi.mock('../lib/use-guest-space-token', () => ({
  useGuestSpaceToken: (slug: string | null) => {
    guestSpaceSlug(slug);
    return { token: guestAccessToken(), ensure: vi.fn() };
  },
}));
vi.mock('../components/app-shell', () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../components/order-track-card', () => ({
  OrderTrackCard: ({ order, pickupToken }: { order: TrackedOrder; pickupToken: string | null }) => (
    <p>
      Estado {order.estado} · QR {pickupToken ?? 'ninguno'}
    </p>
  ),
}));
vi.mock('../components/stripe-payment-panel', () => ({ StripePaymentPanel: () => <p>Formulario de tarjeta</p> }));

const TOKEN = 'S'.repeat(43);
const order = (over: Partial<TrackedOrder> = {}) =>
  ({ id: 'o1', folio: 21, estado: 'por_cobrar', metodo_pago: 'efectivo', total: '60.00', items: [], qr_token: null, invitado: true, ...over }) as TrackedOrder;

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <Routes>
          <Route path="/seguimiento/:token" element={<TrackingPage />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

function sharedTable(overrides: Partial<SharedTable> = {}): SharedTable {
  return {
    espacio: { id: 67, nombre: 'Mesa 67', tipo: 'mesa' },
    sesion_id: 'session-67',
    mi_alias: 'Kikin',
    mi_participante: { id: 'participant-kikin', alias: 'Kikin' },
    cuenta_abierta: true,
    participantes: [
      { id: 'participant-kikin', alias: 'Kikin', soy_yo: true, unido_en: null },
      { id: 'participant-david', alias: 'David', soy_yo: false, unido_en: null },
      { id: 'participant-david-r', alias: 'David R.', soy_yo: false, unido_en: null },
      { id: 'participant-miguel', alias: 'Miguel', soy_yo: false, unido_en: null },
    ],
    grupos: [
      {
        alias: 'Kikin',
        participante_id: 'participant-kikin',
        soy_yo: true,
        pedidos: [
          { id: 'o1', folio: 28, estado: 'cobrado', items_resumen: '1 × Quesadilla', total: '50.00', pendiente_cobro: true, creado_en: null },
          { id: 'o2', folio: 29, estado: 'cobrado', items_resumen: '1 × Agua', total: '20.00', pendiente_cobro: true, creado_en: null },
        ],
        total: '70.00',
        pagado: '0.00',
        pendiente: '70.00',
      },
      {
        alias: 'David',
        participante_id: 'participant-david',
        soy_yo: false,
        pedidos: [
          { id: 'o3', folio: 27, estado: 'cobrado', items_resumen: '1 × Agua', total: '20.00', pendiente_cobro: true, creado_en: null },
        ],
        total: '20.00',
        pagado: '0.00',
        pendiente: '20.00',
      },
    ],
    totales: { total: '90.00', pagado: '0.00', pendiente: '90.00' },
    mi_parte: { total: '70.00', pagado: '0.00', pendiente: '70.00' },
    ...overrides,
  };
}

describe('seguimiento sin cuenta', () => {
  beforeEach(() => {
    localStorage.clear();
    getTracking.mockReset();
    currentTable.mockReset();
    currentTable.mockResolvedValue(null);
    guestAccessToken.mockReset();
    guestAccessToken.mockReturnValue(null);
    guestSpaceSlug.mockReset();
  });

  it('un enlace que no existe muestra solo el error, sin QR ni compartir', async () => {
    getTracking.mockRejectedValue(new VaiinillaApiError(404, { code: 'NOT_FOUND', message: 'Pedido no encontrado' }));
    renderAt('/seguimiento/no-existe');
    expect(await screen.findByRole('heading', { name: /no encontramos este pedido/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver mis pedidos/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ir al menú/i })).toBeInTheDocument();
    expect(screen.queryByText(/guarda este enlace/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /whatsapp/i })).not.toBeInTheDocument();
    expect(screen.queryByAltText(/código qr/i)).not.toBeInTheDocument();
  });

  it('añade la cuenta de mesa al ticket de invitado usando la sesión de este navegador', async () => {
    guestAccessToken.mockReturnValue('guest-jwt');
    getTracking.mockResolvedValue(
      order({
        folio: 28,
        total: '50.00',
        espacio: { id: 67, nombre: 'Mesa 67', tipo: 'mesa' },
        items: [
          {
            id: 1,
            producto_id: 1,
            nombre_producto: 'Quesadilla',
            estacion_preparacion: 'cocina',
            cantidad: 1,
            precio_digital_unitario: '50.00',
            subtotal: '50.00',
            opciones: [],
          },
        ],
      }),
    );
    currentTable.mockResolvedValue(sharedTable());
    rememberGuestOrder({ token: TOKEN, slug: 'demo-a', folio: 28, placeName: 'Mesa 67', createdAt: Date.now() });

    renderAt(`/seguimiento/${TOKEN}`);

    expect(await screen.findByRole('heading', { name: 'Cuenta de la mesa' })).toBeInTheDocument();
    expect(screen.getAllByText(/1 × Quesadilla/)).toHaveLength(2);
    expect(screen.getByText(/4 personas/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tus pedidos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'David' })).toBeInTheDocument();
    expect(screen.getAllByText(/Pedido #28/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Pedido #29/)).toBeInTheDocument();
    expect(screen.getAllByText('$70').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$20').length).toBeGreaterThan(0);
    expect(screen.getByText('Total de la mesa').parentElement).toHaveTextContent('$90');
    expect(screen.getByText('Pagado').parentElement).toHaveTextContent('$0');
    expect(screen.getByText('Por pagar').parentElement).toHaveTextContent('$90');
    expect(screen.getByText('Tu parte por pagar').parentElement).toHaveTextContent('$70');
    expect(screen.getAllByRole('heading', { name: 'Tus pedidos' })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { name: 'David' })).toHaveLength(1);
    expect(screen.queryByRole('heading', { name: 'David R.' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Miguel' })).not.toBeInTheDocument();
    expect(currentTable).toHaveBeenCalledWith('guest-jwt');
    expect(guestSpaceSlug).toHaveBeenCalledWith('demo-a');
  });

  it('mantiene el ticket de invitado cuando falla la cuenta compartida', async () => {
    guestAccessToken.mockReturnValue('guest-jwt');
    getTracking.mockResolvedValue(
      order({
        items: [
          {
            id: 1,
            producto_id: 1,
            nombre_producto: 'Agua',
            estacion_preparacion: 'cocina',
            cantidad: 1,
            precio_digital_unitario: '20.00',
            subtotal: '20.00',
            opciones: [],
          },
        ],
      }),
    );
    currentTable.mockRejectedValue(new Error('sin sesión de mesa'));
    rememberGuestOrder({ token: TOKEN, slug: 'demo-a', folio: 21, placeName: 'Cafetería Demo A', createdAt: Date.now() });

    renderAt(`/seguimiento/${TOKEN}`);

    expect(await screen.findByText(/1 × Agua/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Cuenta de la mesa' })).not.toBeInTheDocument();
  });

  it('actualiza la cuenta cada cinco segundos mientras está visible y limpia el interval', async () => {
    const intervalId = 271 as unknown as number;
    const intervals: Array<() => void> = [];
    const intervalSpy = vi.spyOn(window, 'setInterval').mockImplementation(
      ((handler: TimerHandler, timeout?: number) => {
        if (typeof handler === 'function' && timeout === 5000) intervals.push(handler as () => void);
        return intervalId;
      }) as typeof window.setInterval,
    );
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval').mockImplementation(() => undefined);
    const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    guestAccessToken.mockReturnValue('guest-jwt');
    getTracking.mockResolvedValue(
      order({ folio: 28, espacio: { id: 67, nombre: 'Mesa 67', tipo: 'mesa' } }),
    );
    currentTable.mockResolvedValueOnce(sharedTable());
    rememberGuestOrder({ token: TOKEN, slug: 'demo-a', folio: 28, placeName: 'Mesa 67', createdAt: Date.now() });
    const { unmount } = renderAt(`/seguimiento/${TOKEN}`);

    try {
      expect(await screen.findByRole('heading', { name: 'Cuenta de la mesa' })).toBeInTheDocument();
      expect(intervals).toHaveLength(1);
      expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000);

      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      act(() => {
        intervals[0]?.();
      });
      expect(currentTable).toHaveBeenCalledTimes(1);

      currentTable.mockResolvedValueOnce(
        (() => {
          const [kikinGroup, davidGroup] = sharedTable().grupos;
          return sharedTable({
            grupos: [
              {
                ...kikinGroup!,
              pedidos: [
                  ...kikinGroup!.pedidos,
                  { id: 'o4', folio: 30, estado: 'cobrado', items_resumen: '1 × Agua', total: '10.00', pendiente_cobro: true, creado_en: null },
                ],
                total: '80.00',
                pendiente: '80.00',
              },
              davidGroup!,
            ],
            totales: { total: '100.00', pagado: '0.00', pendiente: '100.00' },
            mi_parte: { total: '80.00', pagado: '0.00', pendiente: '80.00' },
          });
        })(),
      );
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      act(() => {
        intervals[0]?.();
      });

      await waitFor(() => expect(screen.getByText('Total de la mesa').parentElement).toHaveTextContent('$100'));
      expect(screen.getByRole('heading', { name: 'Pedido #28' })).toBeInTheDocument();
      expect(currentTable).toHaveBeenCalledTimes(2);
    } finally {
      unmount();
      expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
      intervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
      if (visibilityDescriptor) Object.defineProperty(document, 'visibilityState', visibilityDescriptor);
      else Reflect.deleteProperty(document, 'visibilityState');
    }
  });

  it('el enlace es respaldo (el pedido vive en Mis pedidos) y deja copiarlo', async () => {
    getTracking.mockResolvedValue(order());
    rememberGuestOrder({ token: TOKEN, slug: 'demo-a', folio: 21, placeName: 'Cafetería Demo A', createdAt: Date.now() });
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderAt(`/seguimiento/${TOKEN}?nuevo=1`);

    expect(await screen.findByText('¡Listo! Guarda este enlace')).toBeInTheDocument();
    expect(screen.getByText(/como respaldo para otro/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver en Mis pedidos' })).toHaveAttribute('href', '/cuenta/pedidos');
    expect(screen.getByText(`${window.location.origin}/seguimiento/${TOKEN}`)).toBeInTheDocument();
    expect(await screen.findByText('Pedido #21')).toBeInTheDocument();
    expect(screen.getByText('Cafetería Demo A')).toBeInTheDocument();
    expect(getTracking).toHaveBeenCalledWith(TOKEN);

    await user.click(screen.getByRole('button', { name: 'Copiar enlace' }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/seguimiento/${TOKEN}`);
    expect(await screen.findByRole('button', { name: 'Enlace copiado' })).toBeInTheDocument();
    // Crear cuenta es opcional, no bloquea.
    expect(screen.getByRole('link', { name: 'Crea tu cuenta' })).toBeInTheDocument();
  });

  it('en este dispositivo invita a verlo en Mis pedidos', async () => {
    getTracking.mockResolvedValue(order());
    rememberGuestOrder({ token: TOKEN, slug: 'demo-a', folio: 21, placeName: 'Cafetería Demo A', createdAt: Date.now() });
    renderAt(`/seguimiento/${TOKEN}`);

    expect(await screen.findByText('Pedido #21')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver en Mis pedidos' })).toHaveAttribute('href', '/cuenta/pedidos');
  });

  it('ya pagado muestra el estado con el QR de recogida', async () => {
    getTracking.mockResolvedValue(order({ estado: 'listo', qr_token: 'v1.qr' }));
    renderAt(`/seguimiento/${TOKEN}`);
    expect(await screen.findByText('Estado listo · QR v1.qr')).toBeInTheDocument();
  });

  it('muestra el pedido completo: artículos, total y método de pago', async () => {
    getTracking.mockResolvedValue(
      order({
        estado: 'preparando',
        metodo_pago: 'efectivo',
        total: '120.00',
        items: [
          {
            id: 1,
            producto_id: 9,
            nombre_producto: 'Torta',
            estacion_preparacion: 'cocina',
            cantidad: 2,
            precio_digital_unitario: '60.00',
            subtotal: '120.00',
            opciones: [],
          },
        ],
      }),
    );
    renderAt(`/seguimiento/${TOKEN}`);
    // Ticket completo, igual que una cuenta registrada: artículos, total y pago.
    expect(await screen.findByText(/2 × Torta/)).toBeInTheDocument();
    expect(screen.getAllByText('$120').length).toBeGreaterThan(0);
    expect(screen.getByText(/Efectivo al recoger/)).toBeInTheDocument();
  });

  it('con tarjeta sin pagar en el dispositivo donde se pidió, muestra el formulario de tarjeta', async () => {
    const { rememberStripeCheckoutSession } = await import('../lib/stripe-session');
    rememberStripeCheckoutSession('o1', { payment_attempt_id: 'a1' } as never);
    getTracking.mockResolvedValue(order({ metodo_pago: 'stripe' }));
    renderAt(`/seguimiento/${TOKEN}`);
    expect(await screen.findByText('Formulario de tarjeta')).toBeInTheDocument();
    const { clearStripeCheckoutSession } = await import('../lib/stripe-session');
    clearStripeCheckoutSession();
  });

  it('con tarjeta sin pagar y sin la sesión de pago en este dispositivo, dice dónde terminarlo', async () => {
    getTracking.mockResolvedValue(order({ metodo_pago: 'stripe' }));
    renderAt(`/seguimiento/${TOKEN}`);
    expect(await screen.findByText(/termínalo en el dispositivo donde hiciste el pedido/i)).toBeInTheDocument();
  });
});
