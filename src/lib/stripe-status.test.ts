import { describe, expect, it } from 'vitest';
import type { OrderDetail } from '../types/api';
import {
  CASH_COUNTER_COPY,
  canRetryStripePayment,
  isStripePaymentConfirmedByBackend,
  pollStripePaymentConfirmation,
  stripeCopyIncludesCashInstructions,
  stripePaymentCopy,
  STRIPE_COPY,
  STRIPE_TOTAL_LABEL,
} from './stripe-status';

function stripeOrder(
  estado: OrderDetail['estado'],
  paymentStatus: NonNullable<OrderDetail['pago']>['payment_status'],
  total = '123.60',
): OrderDetail {
  return {
    id: 'order-1',
    folio: 7,
    fecha_operativa: '2026-09-15',
    estado,
    metodo_pago: 'stripe',
    destino: 'para_llevar',
    espacio: null,
    subtotal: '120.00',
    ahorro_combinado: '0.00',
    cashback_otorgado: '0.00',
    total,
    version: 1,
    creado_en: '2026-09-15T12:00:00Z',
    actualizado_en: '2026-09-15T12:00:00Z',
    notas_cocina: null,
    usuario: { nombre: 'Ana', matricula: null },
    items: [
      {
        id: 1,
        producto_id: 101,
        nombre_producto: 'Chocolate',
        estacion_preparacion: 'cocina',
        cantidad: 1,
        precio_digital_unitario: '120.00',
        subtotal: '120.00',
        opciones: [],
      },
    ],
    pago: {
      payment_attempt_id: 'attempt-1',
      payment_intent_id: 'pi_test_001',
      stripe_account_id: 'acct_test_001',
      payment_status: paymentStatus,
    },
  };
}

describe('stripe confirmation policy', () => {
  it('el total a pagar es el del backend, no un cálculo del cliente', () => {
    const order = stripeOrder('por_cobrar', 'pendiente_pago', '123.60');
    expect(order.total).toBe('123.60');
    expect(STRIPE_TOTAL_LABEL).toBe('Total a pagar');
    expect(order.total).not.toBe('120.00');
  });

  it('processing y requires_action no cuentan como cobrado', () => {
    const processing = stripeOrder('por_cobrar', 'processing');
    const action = stripeOrder('por_cobrar', 'requires_action');
    expect(isStripePaymentConfirmedByBackend(processing)).toBe(false);
    expect(isStripePaymentConfirmedByBackend(action)).toBe(false);
    expect(stripePaymentCopy(processing)).toBe(STRIPE_COPY.processing);
    expect(stripePaymentCopy(action)).toBe(STRIPE_COPY.processing);
    expect(canRetryStripePayment(processing)).toBe(false);
  });

  it('éxito solo con cobrado o estados posteriores y confirmado', () => {
    expect(isStripePaymentConfirmedByBackend(stripeOrder('por_cobrar', 'confirmado'))).toBe(false);
    expect(isStripePaymentConfirmedByBackend(stripeOrder('cobrado', 'confirmado'))).toBe(true);
    expect(isStripePaymentConfirmedByBackend(stripeOrder('preparando', 'confirmado'))).toBe(true);
    expect(stripePaymentCopy(stripeOrder('por_cobrar', 'pendiente_pago'))).toBe(STRIPE_COPY.waiting);
    expect(stripePaymentCopy(stripeOrder('cobrado', 'confirmado'))).toBe(STRIPE_COPY.confirmed);
  });

  it('nunca usa copy de caja para Stripe', () => {
    for (const status of ['pendiente_pago', 'processing', 'confirmado', 'fallido', 'cancelado'] as const) {
      const estado = status === 'confirmado' ? 'cobrado' : 'por_cobrar';
      const copy = stripePaymentCopy(stripeOrder(estado, status));
      expect(stripeCopyIncludesCashInstructions(copy)).toBe(false);
      expect(copy).not.toContain(CASH_COUNTER_COPY);
    }
  });

  it('fallido y cancelado permiten reintento del mismo pedido', () => {
    expect(canRetryStripePayment(stripeOrder('por_cobrar', 'fallido'))).toBe(true);
    expect(canRetryStripePayment(stripeOrder('por_cobrar', 'cancelado'))).toBe(true);
    expect(canRetryStripePayment(stripeOrder('por_cobrar', 'pendiente_pago'))).toBe(false);
  });

  it('el poll no marca éxito mientras processing', async () => {
    const fetches = [
      stripeOrder('por_cobrar', 'processing'),
      stripeOrder('cobrado', 'confirmado'),
    ];
    const result = await pollStripePaymentConfirmation({
      orderId: 'order-1',
      fetchOrder: () => Promise.resolve(fetches.shift() ?? stripeOrder('cobrado', 'confirmado')),
      wait: () => Promise.resolve(),
    });
    expect(result.timedOut).toBe(false);
    expect(result.order && isStripePaymentConfirmedByBackend(result.order)).toBe(true);
  });
});
