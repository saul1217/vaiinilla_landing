import type { OrderDetail, StripePaymentStatus } from '../types/api';

export const STRIPE_POLL_INTERVAL_MS = 3_000;
export const STRIPE_POLL_TIMEOUT_MS = 90_000;
export const STRIPE_POLL_MAX_ATTEMPTS = Math.floor(STRIPE_POLL_TIMEOUT_MS / STRIPE_POLL_INTERVAL_MS) + 1;

export const STRIPE_TOTAL_LABEL = 'Total a pagar';
export const CASH_COUNTER_COPY = 'Pasa a Caja';

export const STRIPE_COPY = {
  waiting: 'Esperando confirmación del pago',
  processing: 'El pago sigue procesándose',
  confirmed: 'Pago confirmado',
  failed: 'El pago no se completó. Puedes reintentarlo.',
  canceled: 'El pago fue cancelado. Puedes reintentarlo.',
  timedOut: 'Seguimos confirmando tu pago',
} as const;

const CONFIRMED_ORDER_STATES: OrderDetail['estado'][] = ['cobrado', 'preparando', 'listo', 'entregado'];

export function isStripePaymentConfirmedByBackend(order: OrderDetail): boolean {
  return (
    order.metodo_pago === 'stripe' &&
    order.pago?.payment_status === 'confirmado' &&
    CONFIRMED_ORDER_STATES.includes(order.estado)
  );
}

export function canRetryStripePayment(order: OrderDetail): boolean {
  const status = order.pago?.payment_status;
  return order.metodo_pago === 'stripe' && (status === 'fallido' || status === 'cancelado');
}

export function stripePaymentCopy(order: OrderDetail): string {
  if (order.metodo_pago !== 'stripe') return '';
  if (isStripePaymentConfirmedByBackend(order)) return STRIPE_COPY.confirmed;
  const status: StripePaymentStatus | undefined = order.pago?.payment_status;
  if (status === 'processing' || status === 'requires_action') return STRIPE_COPY.processing;
  if (status === 'fallido') return STRIPE_COPY.failed;
  if (status === 'cancelado') return STRIPE_COPY.canceled;
  return STRIPE_COPY.waiting;
}

export function stripeCopyIncludesCashInstructions(text: string): boolean {
  return text.includes(CASH_COUNTER_COPY);
}

export interface StripePaymentPollResult {
  order: OrderDetail | null;
  timedOut: boolean;
}

export async function pollStripePaymentConfirmation(options: {
  orderId: string;
  fetchOrder: (id: string) => Promise<OrderDetail>;
  maxAttempts?: number;
  intervalMs?: number;
  wait?: (ms: number) => Promise<void>;
  signal?: AbortSignal;
}): Promise<StripePaymentPollResult> {
  const maxAttempts = options.maxAttempts ?? STRIPE_POLL_MAX_ATTEMPTS;
  const intervalMs = options.intervalMs ?? STRIPE_POLL_INTERVAL_MS;
  const wait = options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  let latest: OrderDetail | null = null;

  for (let index = 0; index < maxAttempts; index += 1) {
    if (options.signal?.aborted) break;
    try {
      latest = await options.fetchOrder(options.orderId);
    } catch {
      // Keep the last successful snapshot; a network blip is not a payment result.
    }
    if (latest && isStripeTerminalStatus(latest)) {
      return { order: latest, timedOut: false };
    }
    if (index < maxAttempts - 1) await wait(intervalMs);
  }

  return { order: latest, timedOut: true };
}

function isStripeTerminalStatus(order: OrderDetail): boolean {
  if (isStripePaymentConfirmedByBackend(order)) return true;
  const status = order.pago?.payment_status;
  return status === 'fallido' || status === 'cancelado' || status === 'reembolsando' || status === 'reembolsado';
}
