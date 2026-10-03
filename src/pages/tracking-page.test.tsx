import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/theme-context';
import { rememberGuestOrder } from '../lib/guest-orders';
import type { TrackedOrder } from '../types/api';
import { TrackingPage } from './tracking-page';

const getTracking = vi.hoisted(() => vi.fn());
vi.mock('../lib/api', () => ({ api: { getTracking: (...a: unknown[]) => getTracking(...a) as Promise<unknown> } }));
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

describe('seguimiento sin cuenta', () => {
  beforeEach(() => {
    localStorage.clear();
    getTracking.mockReset();
  });

  it('avisa claro que el enlace es lo único que tiene, y deja copiarlo', async () => {
    getTracking.mockResolvedValue(order());
    rememberGuestOrder({ token: TOKEN, slug: 'demo-a', folio: 21, placeName: 'Cafetería Demo A', createdAt: Date.now() });
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderAt(`/seguimiento/${TOKEN}?nuevo=1`);

    expect(screen.getByText('¡Listo! Guarda este enlace')).toBeInTheDocument();
    expect(screen.getByText(/única forma/)).toBeInTheDocument();
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
