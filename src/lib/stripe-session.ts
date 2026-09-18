import { moneyToCents } from './money';
import type { OrderDetail, OrderPayment, StripePaymentSession, StripePaymentStatus } from '../types/api';

let memorySession: { orderId: string; session: StripePaymentSession } | null = null;

const STATUSES: StripePaymentStatus[] = [
  'pendiente_pago',
  'processing',
  'requires_action',
  'confirmado',
  'fallido',
  'cancelado',
  'pendiente_reembolso',
  'reembolsando',
  'reembolsado',
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function unwrapPago(source: unknown): Record<string, unknown> {
  const record = asRecord(source);
  if (!record) throw new Error('Stripe order missing pago');
  const nested = asRecord(record.pago);
  if (nested) return nested;
  if (readString(record, 'payment_status') || readString(record, 'client_secret')) return record;
  throw new Error('Stripe order missing pago');
}

export function parseOrderPayment(source: unknown): OrderPayment {
  const pago = unwrapPago(source);
  const paymentAttemptId = readString(pago, 'payment_attempt_id');
  const paymentIntentId = readString(pago, 'payment_intent_id');
  const stripeAccountId = readString(pago, 'stripe_account_id');
  const paymentStatus = readString(pago, 'payment_status') as StripePaymentStatus | undefined;
  if (!paymentAttemptId || !paymentIntentId || !stripeAccountId || !paymentStatus) {
    throw new Error('Stripe order missing pago');
  }
  if (!STATUSES.includes(paymentStatus)) {
    throw new Error('payment_status no soportado');
  }
  return {
    payment_attempt_id: paymentAttemptId,
    payment_intent_id: paymentIntentId,
    stripe_account_id: stripeAccountId,
    payment_status: paymentStatus,
    client_secret: readString(pago, 'client_secret'),
    publishable_key: readString(pago, 'publishable_key'),
    currency: readString(pago, 'currency'),
    amount_cents: typeof pago.amount_cents === 'number' && Number.isSafeInteger(pago.amount_cents)
      ? pago.amount_cents
      : undefined,
  };
}

export function parseStripePaymentSession(source: unknown): StripePaymentSession {
  const pago = parseOrderPayment(source);
  if (!pago.client_secret) throw new Error('Stripe response missing client_secret');
  if (!pago.publishable_key) throw new Error('Stripe response missing publishable_key');
  return {
    payment_attempt_id: pago.payment_attempt_id,
    payment_intent_id: pago.payment_intent_id,
    client_secret: pago.client_secret,
    stripe_account_id: pago.stripe_account_id,
    publishable_key: pago.publishable_key,
    payment_status: pago.payment_status,
  };
}

export function stripeSessionFromCreatedOrder(order: OrderDetail): StripePaymentSession {
  if (order.metodo_pago !== 'stripe') {
    throw new Error('El pedido no es un pago Stripe.');
  }
  const payment = parseOrderPayment(order);
  const totalCents = moneyToCents(order.total);
  if (
    totalCents === null ||
    (payment.amount_cents !== undefined && payment.amount_cents !== Number(totalCents))
  ) {
    throw new Error('El total del pedido no coincide con el PaymentIntent del backend.');
  }
  return parseStripePaymentSession(order);
}

export function rememberStripeCheckoutSession(orderId: string, session: StripePaymentSession): void {
  memorySession = { orderId, session };
}

export function peekStripeCheckoutSession(orderId: string): StripePaymentSession | null {
  return memorySession?.orderId === orderId ? memorySession.session : null;
}

export function takeStripeCheckoutSession(orderId: string): StripePaymentSession | null {
  if (memorySession?.orderId !== orderId) return null;
  const session = memorySession.session;
  memorySession = null;
  return session;
}

export function clearStripeCheckoutSession(orderId?: string): void {
  if (!orderId || memorySession?.orderId === orderId) memorySession = null;
}
