import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/theme-context';
import { VaiinillaApiError } from '../lib/api-error';
import { readPendingStripeOrderId, savePendingStripeOrderId } from '../lib/stripe-pending';
import { rememberStripeCheckoutSession } from '../lib/stripe-session';
import { CASH_COUNTER_COPY, STRIPE_COPY, STRIPE_TOTAL_LABEL } from '../lib/stripe-status';
import type { OrderDetail, SharedTable, SharedTableOrder } from '../types/api';
import { OrderDetailPage } from './order-detail-page';

const { getEstablishment, getGuestCatalog, getOrder, getOrderQr, retryStripePayment, currentTable } = vi.hoisted(() => ({
  getEstablishment: vi.fn(),
  getGuestCatalog: vi.fn(),
  getOrder: vi.fn(),
  getOrderQr: vi.fn(),
  retryStripePayment: vi.fn(),
  currentTable: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    getEstablishment: (...args: unknown[]) => getEstablishment(...args) as Promise<unknown>,
    getGuestCatalog: (...args: unknown[]) => getGuestCatalog(...args) as Promise<unknown>,
    getOrder: (...args: unknown[]) => getOrder(...args) as Promise<unknown>,
    getOrderQr: (...args: unknown[]) => getOrderQr(...args) as Promise<unknown>,
    retryStripePayment: (...args: unknown[]) => retryStripePayment(...args) as Promise<unknown>,
    currentTable: (...args: unknown[]) => currentTable(...args) as Promise<unknown>,
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
  useBuyerSessionToken: () => null,
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

vi.mock('@stripe/stripe-js/pure', () => ({
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

function mesaOrder(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return stripeOrder({
    estado: 'cobrado',
    metodo_pago: 'saldo',
    destino: 'en_espacio',
    espacio: { id: 4, nombre: 'Mesa 4', tipo: 'mesa' },
    total: '70.00',
    pago: null,
    items: [
      {
        id: 2,
        producto_id: 2,
        nombre_producto: 'Taco de prueba',
        estacion_preparacion: 'cocina',
        cantidad: 1,
        precio_digital_unitario: '70.00',
        subtotal: '70.00',
        opciones: [],
      },
    ],
    ...overrides,
  });
}

function sharedOrder(overrides: Partial<SharedTableOrder> = {}): SharedTableOrder {
  return {
    id: 'ord-1',
    folio: 7,
    estado: 'cobrado',
    items_resumen: '1 × Taco de mesa',
    total: '70.00',
    pendiente_cobro: true,
    creado_en: '2026-09-15T12:00:00Z',
    ...overrides,
  };
}

function sharedTable(overrides: Partial<SharedTable> = {}): SharedTable {
  return {
    espacio: { id: 4, nombre: 'Mesa 4', tipo: 'mesa' },
    sesion_id: 'session-4',
    mi_alias: 'Ana',
    mi_participante: { id: 'participant-ana', alias: 'Ana' },
    cuenta_abierta: true,
    participantes: [{ id: 'participant-ana', alias: 'Ana', soy_yo: true, unido_en: '2026-09-15T12:00:00Z' }],
    grupos: [
      {
        alias: 'Ana',
        participante_id: 'participant-ana',
        soy_yo: true,
        pedidos: [sharedOrder()],
        total: '70.00',
        pagado: '0.00',
        pendiente: '70.00',
      },
    ],
    totales: { total: '70.00', pagado: '0.00', pendiente: '70.00' },
    mi_parte: { total: '70.00', pagado: '0.00', pendiente: '70.00' },
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
  let visibilityDescriptor: PropertyDescriptor | undefined;
  let printDescriptor: PropertyDescriptor | undefined;
  let spyCleanups: Array<() => void> = [];

  beforeEach(() => {
    spyCleanups = [];
    visibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    printDescriptor = Object.getOwnPropertyDescriptor(window, 'print');
    sessionStorage.clear();
    localStorage.clear();
    getEstablishment.mockReset();
    getEstablishment.mockResolvedValue({
      id: 'e1',
      nombre: 'Demo A',
      slug: 'demo-a',
      identificador_cliente_etiqueta: 'Cliente',
      identificador_cliente_obligatorio: false,
    });
    getGuestCatalog.mockReset();
    getGuestCatalog.mockResolvedValue({ categorias: [], productos: [] });
    getOrder.mockReset();
    getOrderQr.mockReset();
    getOrderQr.mockRejectedValue(new Error('QR recovery not configured in this test'));
    retryStripePayment.mockReset();
    currentTable.mockReset();
    currentTable.mockResolvedValue(null);
  });

  afterEach(() => {
    for (const cleanup of spyCleanups) cleanup();
    if (visibilityDescriptor) Object.defineProperty(document, 'visibilityState', visibilityDescriptor);
    else Reflect.deleteProperty(document, 'visibilityState');
    if (printDescriptor) Object.defineProperty(window, 'print', printDescriptor);
    else Reflect.deleteProperty(window, 'print');
  });

  it('muestra ticket con QR, mesa y pasos', async () => {
    getOrder.mockResolvedValue({
      id: 'ord-1',
      folio: 42,
      estado: 'listo',
      metodo_pago: 'saldo',
      estado_pago: 'pagado',
      monto_pagado: '70.00',
      saldo_pendiente: '0.00',
      destino: 'en_espacio',
      espacio: { id: 4, nombre: 'Mesa 4', tipo: 'mesa' },
      total: '70.00',
      notas_cocina: 'Sin cebolla',
      qr_token: 'ticket-token',
      items: [{ id: 1, nombre_producto: 'Burrito', cantidad: 1, subtotal: '70.00' }],
    });
    renderOrder();
    expect(await screen.findByRole('heading', { name: /#42/i })).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: /código qr del pedido/i })).toHaveAttribute(
      'src',
      'data:image/png;base64,qr',
    );
    expect(screen.getAllByRole('region', { name: /código de retiro/i })).toHaveLength(1);
    expect(document.querySelector('.alumno-card--ticket .alumno-pickup')).toBeNull();
    expect(document.querySelector('.alumno-track-card__status')).toBeNull();
    expect(document.querySelector('.alumno-detail-split .alumno-card--ticket')).not.toBeNull();
    expect(screen.getAllByText(/pagado/i)).toHaveLength(2);
    expect(screen.getAllByText(/mesa 4/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/1 × burrito/i)).toBeInTheDocument();
    expect(screen.getAllByText('$70').length).toBeGreaterThan(0);
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
    expect(await screen.findByRole('img', { name: /código qr del pedido/i })).toBeInTheDocument();
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
    expect(await screen.findByRole('img', { name: /código qr del pedido/i })).toBeInTheDocument();
  });

  it('en listo muestra folio de retiro si el API no envía secreto', async () => {
    getOrder.mockResolvedValue(
      stripeOrder({
        folio: 1,
        estado: 'listo',
        estado_pago: 'pagado',
        monto_pagado: '123.60',
        saldo_pendiente: '0.00',
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
    expect(await screen.findByRole('region', { name: /código de retiro/i })).toBeInTheDocument();
    expect(screen.getAllByText('#1').length).toBeGreaterThan(1);
    expect((document.body.textContent?.match(/Recógelo en la barra/gi) ?? []).length).toBe(1);
    expect(document.querySelector('.alumno-card--ticket .alumno-pickup')).toBeNull();
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
    expect(await screen.findByRole('img', { name: /código qr del pedido/i })).toBeInTheDocument();
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
        estado_pago: 'pagado',
        monto_pagado: '123.60',
        saldo_pendiente: '0.00',
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

  it('pedido normal: conserva el ticket individual y no consulta la cuenta de mesa', async () => {
    getOrder.mockResolvedValue(stripeOrder({ metodo_pago: 'saldo', estado: 'cobrado' }));
    const { container } = renderOrder();

    expect(await screen.findByText(/Pedido #7/)).toBeInTheDocument();
    expect(container.querySelector('.alumno-card--ticket')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /cuenta de la mesa/i })).not.toBeInTheDocument();
    expect(currentTable).not.toHaveBeenCalled();
  });

  it('pedido de una mesa activa: muestra el detalle individual y la cuenta agrupada', async () => {
    getOrder.mockResolvedValue(mesaOrder());
    currentTable.mockResolvedValue(sharedTable());
    renderOrder();

    expect(await screen.findByText('1 × Taco de prueba')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Cuenta de la mesa' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tus pedidos' })).toBeInTheDocument();
    expect(currentTable).toHaveBeenCalledWith('jwt');
  });

  it('muestra cada participante una vez, agrupa sus pedidos y usa los montos del backend', async () => {
    getOrder.mockResolvedValue(mesaOrder());
    currentTable.mockResolvedValue(
      sharedTable({
        participantes: [
          { id: 'participant-ana', alias: 'Ana', soy_yo: true, unido_en: '2026-09-15T12:00:00Z' },
          { id: 'participant-luis', alias: 'Luis', soy_yo: false, unido_en: '2026-09-15T12:01:00Z' },
        ],
        grupos: [
          {
            alias: 'Ana',
            participante_id: 'participant-ana',
            soy_yo: true,
            pedidos: [
              sharedOrder({ folio: 7, items_resumen: '1 × Taco primero', total: '12.00' }),
              sharedOrder({ id: 'ana-order-2', folio: 8, items_resumen: '2 × Taco segundo', total: '18.00' }),
            ],
            total: '888.88',
            pagado: '88.88',
            pendiente: '800.00',
          },
          {
            alias: 'Luis',
            participante_id: 'participant-luis',
            soy_yo: false,
            pedidos: [
              sharedOrder({ id: null, folio: 9, items_resumen: '1 × Agua', total: '5.00' }),
            ],
            total: '5.00',
            pagado: '0.00',
            pendiente: '5.00',
          },
        ],
        totales: { total: '777777.77', pagado: '111.11', pendiente: '777666.66' },
        mi_parte: { total: '333.33', pagado: '10.00', pendiente: '323.33' },
      }),
    );
    renderOrder();

    expect(await screen.findByRole('heading', { name: 'Cuenta de la mesa' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Tus pedidos' })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { name: 'Luis' })).toHaveLength(1);
    expect(screen.getByText('1 × Taco primero')).toBeInTheDocument();
    expect(screen.getByText('2 × Taco segundo')).toBeInTheDocument();
    expect(screen.getByText('Subtotal de tus pedidos').parentElement).toHaveTextContent('$888.88');
    expect(screen.getByText('Total de la mesa').parentElement).toHaveTextContent('$777777.77');
    expect(screen.getByText('Tu parte por pagar').parentElement).toHaveTextContent('$323.33');
  });

  it('conserva separados a participantes distintos aunque compartan alias', async () => {
    getOrder.mockResolvedValue(mesaOrder());
    currentTable.mockResolvedValue(
      sharedTable({
        participantes: [
          { id: 'participant-ana-1', alias: 'Ana', soy_yo: true, unido_en: null },
          { id: 'participant-ana-2', alias: 'Ana', soy_yo: false, unido_en: null },
        ],
        grupos: [
          {
            alias: 'Ana',
            participante_id: 'participant-ana-1',
            soy_yo: true,
            pedidos: [sharedOrder({ id: 'ord-1', folio: 7, items_resumen: '1 × Taco propio' })],
            total: '70.00',
            pagado: '0.00',
            pendiente: '70.00',
          },
          {
            alias: 'Ana',
            participante_id: 'participant-ana-2',
            soy_yo: false,
            pedidos: [sharedOrder({ id: 'ana-2-order', folio: 8, items_resumen: '1 × Agua' })],
            total: '5.00',
            pagado: '0.00',
            pendiente: '5.00',
          },
        ],
      }),
    );

    renderOrder();

    expect(await screen.findByRole('heading', { name: 'Cuenta de la mesa' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Tus pedidos' })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { name: 'Ana' })).toHaveLength(1);
    expect(screen.getByText('1 × Taco propio')).toBeInTheDocument();
    expect(screen.getByText('1 × Agua')).toBeInTheDocument();
    expect(document.querySelectorAll('.alumno-ticket-table__group')).toHaveLength(2);
  });

  it('no muestra una sesión activa que no contiene el pedido consultado', async () => {
    getOrder.mockResolvedValue(mesaOrder());
    currentTable.mockResolvedValue(
      sharedTable({
        grupos: [
          {
            alias: 'Ana',
            participante_id: 'participant-ana',
            soy_yo: true,
            pedidos: [sharedOrder({ id: 'another-order', folio: 99 })],
            total: '99.00',
            pagado: '0.00',
            pendiente: '99.00',
          },
        ],
      }),
    );
    const { container } = renderOrder();

    expect(await screen.findByText('1 × Taco de prueba')).toBeInTheDocument();
    await waitFor(() => expect(currentTable).toHaveBeenCalled());
    expect(container.querySelector('.alumno-card--ticket')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /cuenta de la mesa/i })).not.toBeInTheDocument();
  });

  it('si no existe una cuenta activa, muestra solamente el ticket individual', async () => {
    getOrder.mockResolvedValue(mesaOrder());
    currentTable.mockResolvedValue(null);
    const { container } = renderOrder();

    expect(await screen.findByText('1 × Taco de prueba')).toBeInTheDocument();
    await waitFor(() => expect(currentTable).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: /cuenta de la mesa/i })).not.toBeInTheDocument();
    expect(container.querySelector('.alumno-card--ticket')).toBeInTheDocument();
  });

  it('pedido histórico: renderiza sin consultar ni requerir participantes', async () => {
    getOrder.mockResolvedValue(mesaOrder({ espacio: null, estado: 'entregado' }));
    const { container } = renderOrder();

    expect(await screen.findByText('1 × Taco de prueba')).toBeInTheDocument();
    expect(container.querySelector('.alumno-card--ticket')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /cuenta de la mesa/i })).not.toBeInTheDocument();
    expect(currentTable).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'UNAUTHENTICATED'],
    [403, 'FORBIDDEN_ROLE'],
    [404, 'SPACE_NOT_FOUND'],
  ])('si currentTable devuelve %i, mantiene el comprobante y no registra error', async (status, code) => {
    getOrder.mockResolvedValue(mesaOrder());
    currentTable.mockRejectedValue(
      new VaiinillaApiError(status, { code, message: 'Cuenta no disponible', details: [] }),
    );
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    spyCleanups.push(() => consoleError.mockRestore());
    const { container } = renderOrder();

    expect(await screen.findByText('1 × Taco de prueba')).toBeInTheDocument();
    await waitFor(() => expect(currentTable).toHaveBeenCalled());
    expect(container.querySelector('.alumno-card--ticket')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /cuenta de la mesa/i })).not.toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('si currentTable falla por red, mantiene el comprobante individual', async () => {
    getOrder.mockResolvedValue(mesaOrder());
    currentTable.mockRejectedValue(new Error('network unavailable'));
    const { container } = renderOrder();

    expect(await screen.findByText('1 × Taco de prueba')).toBeInTheDocument();
    expect(container.querySelector('.alumno-card--ticket')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /cuenta de la mesa/i })).not.toBeInTheDocument();
  });

  it('el ticket no espera a que cargue la cuenta compartida', async () => {
    let resolveTable: (value: SharedTable | null) => void = () => undefined;
    currentTable.mockReturnValue(
      new Promise<SharedTable | null>((resolve) => {
        resolveTable = resolve;
      }),
    );
    getOrder.mockResolvedValue(mesaOrder());
    renderOrder();

    expect(await screen.findByText('1 × Taco de prueba')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /cuenta de la mesa/i })).not.toBeInTheDocument();
    resolveTable(sharedTable());
    expect(await screen.findByRole('heading', { name: 'Cuenta de la mesa' })).toBeInTheDocument();
  });

  it('refresca cada cinco segundos solo cuando está visible y limpia el interval al desmontar', async () => {
    const intervalId = 314 as unknown as number;
    const intervals: Array<{ callback: () => void; delay: number }> = [];
    const intervalSpy = vi.spyOn(window, 'setInterval').mockImplementation(
      ((handler: TimerHandler, timeout?: number) => {
        if (typeof handler === 'function' && timeout === 5000) {
          intervals.push({ callback: handler as () => void, delay: Number(timeout) });
        }
        return intervalId;
      }) as typeof window.setInterval,
    );
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval').mockImplementation(() => undefined);
    spyCleanups.push(() => intervalSpy.mockRestore(), () => clearIntervalSpy.mockRestore());
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    getOrder.mockResolvedValue(mesaOrder());
    currentTable.mockResolvedValueOnce(sharedTable());
    const { container, unmount } = renderOrder();

    expect(await screen.findByRole('heading', { name: 'Cuenta de la mesa' })).toBeInTheDocument();
    expect(intervalSpy.mock.calls.filter(([, delay]) => delay === 5000)).toHaveLength(1);
    expect(intervals).toHaveLength(1);
    expect(intervals[0]?.delay).toBe(5000);

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    await act(() => {
      intervals[0]?.callback();
      return Promise.resolve();
    });
    expect(currentTable).toHaveBeenCalledTimes(1);

    currentTable.mockResolvedValueOnce(
      sharedTable({
        grupos: [
          {
            alias: 'Ana',
            participante_id: 'participant-ana',
            soy_yo: true,
            pedidos: [sharedOrder()],
            total: '456.78',
            pagado: '0.00',
            pendiente: '456.78',
          },
        ],
        totales: { total: '456.78', pagado: '0.00', pendiente: '456.78' },
        mi_parte: { total: '456.78', pagado: '0.00', pendiente: '456.78' },
      }),
    );
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    await act(() => {
      intervals[0]?.callback();
      return Promise.resolve();
    });

    await waitFor(() =>
      expect(screen.getByText('Total de la mesa').parentElement).toHaveTextContent('$456.78'),
    );
    expect(screen.getByText('1 × Taco de prueba')).toBeInTheDocument();
    expect(container.querySelectorAll('.alumno-ticket-table')).toHaveLength(1);
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
  });

  it('no ofrece imprimir el ticket al cliente', async () => {
    getOrder.mockResolvedValue(mesaOrder());
    renderOrder();

    await waitFor(() => expect(document.querySelector('.alumno-card--ticket')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /imprimir (ticket|cuenta)/i })).not.toBeInTheDocument();
  });
});
