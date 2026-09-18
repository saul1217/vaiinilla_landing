import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/theme-context';
import { readPendingStripeOrderId, savePendingStripeOrderId } from '../lib/stripe-pending';
import { rememberStripeCheckoutSession } from '../lib/stripe-session';
import { CASH_COUNTER_COPY, STRIPE_COPY, STRIPE_TOTAL_LABEL } from '../lib/stripe-status';
import type { OrderDetail } from '../types/api';
import { OrderDetailPage } from './order-detail-page';

const { getOrder, getOrderQr, retryStripePayment } = vi.hoisted(() => ({
  getOrder: vi.fn(),
  getOrderQr: vi.fn(),
  retryStripePayment: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    getEstablishment: vi.fn(),
    getGuestCatalog: vi.fn().mockResolvedValue({ categorias: [], productos: [] }),
    getOrder: (...args: unknown[]) => getOrder(...args) as Promise<unknown>,
    getOrderQr: (...args: unknown[]) => getOrderQr(...args) as Promise<unknown>,
    retryStripePayment: (...args: unknown[]) => retryStripePayment(...args) as Promise<unknown>,
    apiUrl: '/api/v1',
  },
}));

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({
    user: { email: 'ana@example.test', displayName: 'Ana' },
    ready: true,
    configured: true,
    signOut: vi.fn(),
  }),
}));

vi.mock('../context/cart-context', () => ({
  useCart: () => ({ cart: { slug: 'demo-a', establishmentName: 'Demo A', lines: [] } }),
}));

vi.mock('../context/buyer-session', () => ({
  useBuyerSession: () => ({
    context: { access_token: 'jwt', contexto: { establecimiento_id: 'e1' } },
    opening: false,
    openClientSession: vi.fn(),
    clearSession: vi.fn(),
  }),
}));

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,qr') },
}));

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn().mockResolvedValue({}),
}));

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PaymentElement: ({ onReady }: { onReady?: () => void }) => {
    useEffect(() => onReady?.(), [onReady]);
    return <div data-testid="stripe-payment-element" />;
  },
  useStripe: () => ({ confirmPayment: vi.fn().mockResolvedValue({}) }),
  useElements: () => ({ getElement: () => ({}) }),
}));

function stripeOrder(overrides: Partial<OrderDetail> & { pago?: OrderDetail['pago'] }): OrderDetail {
  return {
    id: 'ord-1',
    folio: 7,
    fecha_operativa: '2026-09-15',
    estado: 'por_cobrar',
    metodo_pago: 'stripe',
    destino: 'para_llevar',
    espacio: null,
    subtotal: '120.00',
    ahorro_combinado: '0.00',
    cashback_otorgado: '0.00',
    total: '123.60',
    version: 1,
    creado_en: '2026-09-15T12:00:00Z',
    actualizado_en: '2026-09-15T12:00:00Z',
    notas_cocina: null,
    usuario: { nombre: 'Ana', matricula: null },
    items: [{ id: 1, producto_id: 1, nombre_producto: 'Chocolate', estacion_preparacion: 'cocina', cantidad: 1, precio_digital_unitario: '120.00', subtotal: '120.00', opciones: [] }],
    pago: {
      payment_attempt_id: 'attempt-1',
      payment_intent_id: 'pi_test_001',
      stripe_account_id: 'acct_test_001',
      payment_status: 'pendiente_pago',
    },
    ...overrides,
  };
}

function renderOrder() {
  return render(
    <MemoryRouter initialEntries={['/cuenta/pedidos/ord-1']}>
      <ThemeProvider>
        <Routes>
          <Route path="/cuenta/pedidos/:id" element={<OrderDetailPage />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('OrderDetailPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    getOrder.mockReset();
    getOrderQr.mockReset();
    getOrderQr.mockRejectedValue(new Error('QR recovery not configured in this test'));
    retryStripePayment.mockReset();
  });

  it('muestra ticket con QR, mesa y pasos', async () => {
    getOrder.mockResolvedValue({
      id: 'ord-1',
      folio: 42,
      estado: 'listo',
      metodo_pago: 'saldo',
      destino: 'en_espacio',
      espacio: { id: 4, nombre: 'Mesa 4', tipo: 'mesa' },
      total: '70.00',
      notas_cocina: 'Sin cebolla',
      qr_token: 'ticket-token',
      items: [{ id: 1, nombre_producto: 'Burrito', cantidad: 1, subtotal: '70.00' }],
    });
    renderOrder();
    expect(await screen.findByRole('heading', { name: /#42/i })).toBeInTheDocument();
    expect((await screen.findAllByAltText(/código qr del pedido/i))[0]).toHaveAttribute(
      'src',
      'data:image/png;base64,qr',
    );
    expect(screen.getByText(/pagado con saldo/i)).toBeInTheDocument();
    expect(screen.getAllByText(/mesa 4/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/1 × burrito/i)).toBeInTheDocument();
    expect(screen.getByText(/sin cebolla/i)).toBeInTheDocument();
  });

  it('recupera el QR guardado al crear el pedido cuando el detalle no lo devuelve', async () => {
    sessionStorage.setItem('vaiinilla.buyer.pickup-qr.v1.ord-1', 'pickup-token');
    getOrder.mockResolvedValue({
      ...stripeOrder({ metodo_pago: 'saldo', estado: 'listo' }),
      metodo_pago: 'saldo',
      qr_token: undefined,
    });
    renderOrder();
    expect((await screen.findAllByRole('img', { name: /código qr del pedido/i })).length).toBeGreaterThan(0);
  });

  it('conserva el QR en localStorage si la visita nueva pierde sessionStorage', async () => {
    localStorage.setItem('vaiinilla.buyer.pickup-qr.v1.ord-1', 'pickup-token');
    sessionStorage.clear();
    getOrder.mockResolvedValue({
      ...stripeOrder({ metodo_pago: 'saldo', estado: 'listo' }),
      metodo_pago: 'saldo',
      qr_token: undefined,
    });
    renderOrder();
    expect((await screen.findAllByRole('img', { name: /código qr del pedido/i })).length).toBeGreaterThan(0);
  });

  it('en listo muestra folio de retiro si el API no envía secreto', async () => {
    getOrder.mockResolvedValue(
      stripeOrder({
        folio: 1,
        estado: 'listo',
        qr_token: undefined,
        pago: {
          payment_attempt_id: 'attempt-1',
          payment_intent_id: 'pi_test_001',
          stripe_account_id: 'acct_test_001',
          payment_status: 'confirmado',
        },
      }),
    );
    renderOrder();
    expect((await screen.findAllByRole('region', { name: /código de retiro/i })).length).toBeGreaterThan(0);
    expect(screen.getAllByText('#1').length).toBeGreaterThan(1);
    expect(screen.getAllByText(/muestra esto en la barra/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole('img', { name: /código qr/i })).not.toBeInTheDocument();
  });

  it('recupera el QR desde el backend si se abre en otro dispositivo', async () => {
    getOrder.mockResolvedValue({
      ...stripeOrder({ metodo_pago: 'saldo', estado: 'listo' }),
      metodo_pago: 'saldo',
      qr_token: undefined,
    });
    getOrderQr.mockResolvedValue({ qr_token: 'recovered-token' });
    renderOrder();
    expect((await screen.findAllByRole('img', { name: /código qr del pedido/i })).length).toBeGreaterThan(0);
    expect(getOrderQr).toHaveBeenCalledWith('jwt', 'ord-1');
  });

  it('muestra el total del backend antes de pagar y nunca copy de caja', async () => {
    rememberStripeCheckoutSession('ord-1', {
      payment_attempt_id: 'attempt-1',
      payment_intent_id: 'pi_test_001',
      client_secret: 'pi_test_001_secret_test',
      stripe_account_id: 'acct_test_001',
      publishable_key: 'pk_test_51Vaiinilla',
      payment_status: 'pendiente_pago',
    });
    getOrder.mockResolvedValue(stripeOrder({ total: '123.60' }));
    renderOrder();
    expect(await screen.findByText(STRIPE_TOTAL_LABEL)).toBeInTheDocument();
    const payTotal = screen.getByText(STRIPE_TOTAL_LABEL).closest('.alumno-stripe-total');
    expect(payTotal).toHaveTextContent('$123.60 MXN');
    expect(payTotal).not.toHaveTextContent('$120.00');
    expect(screen.getByText(STRIPE_COPY.waiting)).toBeInTheDocument();
    expect(screen.getByTestId('stripe-payment-element')).toBeInTheDocument();
    expect(screen.queryByText(CASH_COUNTER_COPY)).not.toBeInTheDocument();
  });

  it('después de Pagar ahora no vuelve a mostrar el formulario', async () => {
    rememberStripeCheckoutSession('ord-1', {
      payment_attempt_id: 'attempt-1',
      payment_intent_id: 'pi_test_001',
      client_secret: 'pi_test_001_secret_test',
      stripe_account_id: 'acct_test_001',
      publishable_key: 'pk_test_51Vaiinilla',
      payment_status: 'pendiente_pago',
    });
    getOrder.mockResolvedValue(stripeOrder({}));
    const user = userEvent.setup();
    renderOrder();
    await user.click(await screen.findByRole('button', { name: /pagar ahora/i }));
    expect(await screen.findByText(STRIPE_COPY.processing)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pagar ahora/i })).not.toBeInTheDocument();
  });

  it('processing no se muestra como cobrado ni permite retry', async () => {
    getOrder.mockResolvedValue(
      stripeOrder({
        pago: {
          payment_attempt_id: 'attempt-1',
          payment_intent_id: 'pi_test_001',
          stripe_account_id: 'acct_test_001',
          payment_status: 'processing',
        },
      }),
    );
    renderOrder();
    expect(await screen.findByText(STRIPE_COPY.processing)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText(STRIPE_COPY.confirmed)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reintentar pago/i })).not.toBeInTheDocument();
    expect(screen.queryByText(CASH_COUNTER_COPY)).not.toBeInTheDocument();
  });

  it('éxito solo con cobrado y confirmado', async () => {
    getOrder.mockResolvedValue(
      stripeOrder({
        estado: 'cobrado',
        pago: {
          payment_attempt_id: 'attempt-1',
          payment_intent_id: 'pi_test_001',
          stripe_account_id: 'acct_test_001',
          payment_status: 'confirmado',
        },
      }),
    );
    renderOrder();
    expect(await screen.findByText(STRIPE_COPY.confirmed)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ver pedido/i })).not.toBeInTheDocument();
    expect(screen.queryByText(CASH_COUNTER_COPY)).not.toBeInTheDocument();
  });

  it('reintenta el mismo pedido sin crear otro', async () => {
    getOrder.mockResolvedValue(
      stripeOrder({
        pago: {
          payment_attempt_id: 'attempt-1',
          payment_intent_id: 'pi_test_001',
          stripe_account_id: 'acct_test_001',
          payment_status: 'fallido',
        },
      }),
    );
    retryStripePayment.mockResolvedValue({
      // The backend may safely reuse the same PaymentIntent when it is still
      // requires_payment_method; the retry must still remount the form.
      payment_attempt_id: 'attempt-1',
      payment_intent_id: 'pi_test_001',
      client_secret: 'pi_test_001_secret_retry',
      stripe_account_id: 'acct_test_001',
      publishable_key: 'pk_test_51Vaiinilla',
      payment_status: 'pendiente_pago',
    });
    const user = userEvent.setup();
    renderOrder();
    await user.click(await screen.findByRole('button', { name: /reintentar pago/i }));
    expect(retryStripePayment).toHaveBeenCalledTimes(1);
    expect(retryStripePayment.mock.calls[0]?.[1]).toBe('ord-1');
    expect(retryStripePayment.mock.calls[0]?.[2]).toEqual(expect.any(String));
    expect(await screen.findByTestId('stripe-payment-element')).toBeInTheDocument();
  });

  it('libera el bloqueo local cuando el intento ya terminó fallido', async () => {
    savePendingStripeOrderId('ord-1');
    rememberStripeCheckoutSession('ord-1', {
      payment_attempt_id: 'attempt-1',
      payment_intent_id: 'pi_test_001',
      client_secret: 'pi_test_001_secret_test',
      stripe_account_id: 'acct_test_001',
      publishable_key: 'pk_test_51Vaiinilla',
      payment_status: 'pendiente_pago',
    });
    getOrder.mockResolvedValue(
      stripeOrder({
        pago: {
          payment_attempt_id: 'attempt-1',
          payment_intent_id: 'pi_test_001',
          stripe_account_id: 'acct_test_001',
          payment_status: 'fallido',
        },
      }),
    );
    renderOrder();
    expect(await screen.findByText(STRIPE_COPY.failed)).toBeInTheDocument();
    expect(readPendingStripeOrderId()).toBeNull();
    expect(await screen.findByRole('button', { name: /reintentar pago/i })).toBeInTheDocument();
    expect(screen.queryByTestId('stripe-payment-element')).not.toBeInTheDocument();
  });

  it('conserva el bloqueo local si el pago todavía no tiene estado terminal', async () => {
    savePendingStripeOrderId('ord-1');
    rememberStripeCheckoutSession('ord-1', {
      payment_attempt_id: 'attempt-1',
      payment_intent_id: 'pi_test_001',
      client_secret: 'pi_test_001_secret_test',
      stripe_account_id: 'acct_test_001',
      publishable_key: 'pk_test_51Vaiinilla',
      payment_status: 'pendiente_pago',
    });
    getOrder.mockResolvedValue(stripeOrder({}));
    const user = userEvent.setup();
    renderOrder();
    await user.click(await screen.findByRole('button', { name: /salir del pago/i }));
    expect(readPendingStripeOrderId()).toBe('ord-1');
    expect(await screen.findByRole('button', { name: /reintentar pago/i })).toBeInTheDocument();
  });
});
