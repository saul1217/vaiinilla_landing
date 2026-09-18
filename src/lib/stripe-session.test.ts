import { describe, expect, it } from 'vitest';
import type { OrderDetail } from '../types/api';
import {
  parseStripePaymentSession,
  stripeSessionFromCreatedOrder,
} from './stripe-session';

const createdPago = {
  payment_attempt_id: 'attempt-1',
  payment_intent_id: 'pi_test_001',
  stripe_account_id: 'acct_test_establecimiento_001',
  payment_status: 'pendiente_pago' as const,
  amount_cents: 6200,
  client_secret: 'pi_test_001_secret_test',
  publishable_key: 'pk_test_51Vaiinilla',
};

describe('stripe session contract', () => {
  it('separa credenciales efímeras del pedido creado', () => {
    const order = {
      id: 'order-1',
      folio: 42,
      estado: 'por_cobrar',
      metodo_pago: 'stripe',
      total: '62.00',
      pago: createdPago,
    } as OrderDetail;

    const session = stripeSessionFromCreatedOrder(order);
    expect(session.client_secret).toBe('pi_test_001_secret_test');
    expect(session.stripe_account_id).toBe('acct_test_establecimiento_001');
    expect(session.publishable_key).toBe('pk_test_51Vaiinilla');
  });

  it('acepta el envelope de reintento { pago } sin body extra', () => {
    const session = parseStripePaymentSession({ pago: createdPago });
    expect(session.payment_intent_id).toBe('pi_test_001');
    expect(session.client_secret).toBe('pi_test_001_secret_test');
  });

  it('rechaza abrir Stripe si PaymentIntent.amount no coincide con el total del backend', () => {
    const order = {
      id: 'order-mismatch',
      folio: 43,
      estado: 'por_cobrar',
      metodo_pago: 'stripe',
      total: '62.00',
      pago: { ...createdPago, amount_cents: 6199 },
    } as OrderDetail;

    expect(() => stripeSessionFromCreatedOrder(order)).toThrow(/no coincide/i);
  });

  it('GET sin secretos no inventa un PaymentIntent', () => {
    expect(() =>
      parseStripePaymentSession({
        pago: {
          payment_attempt_id: 'attempt-1',
          payment_intent_id: 'pi_test_001',
          stripe_account_id: 'acct_test_001',
          payment_status: 'pendiente_pago',
          amount_cents: 6200,
        },
      }),
    ).toThrow(/client_secret/);
  });
});
