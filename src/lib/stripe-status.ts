import type { OrderDetail, StripePaymentStatus } from '../types/api';

export const STRIPE_POLL_INTERVAL_MS = 3_000;
export const STRIPE_POLL_TIMEOUT_MS = 90_000;
export const STRIPE_POLL_MAX_ATTEMPTS = Math.floor(STRIPE_POLL_TIMEOUT_MS / STRIPE_POLL_INTERVAL_MS) + 1;

export const STRIPE_TOTAL_LABEL = 'Total a pagar';
export const STRIPE_ADVANCE_LABEL = 'Anticipo a pagar';
export const CASH_COUNTER_COPY = 'Pasa a Caja';

export const STRIPE_COPY = {
  waiting: 'Esperando confirmación del pago',
  processing: 'Tu compra está en proceso',
  confirmed: '¡Ya se cobró!',
  failed: 'El pago no se completó. Puedes reintentarlo.',
  canceled: 'El pago fue cancelado. Puedes reintentarlo.',
  timedOut: 'Seguimos confirmando tu pago',
  awaitingAcceptance: 'Pagas cuando el negocio acepte tu pedido.',
  paidAwaitingAcceptance: 'Ya pagaste. El negocio está revisando tu pedido.',
  paymentWindowExpired: 'Se pasó el plazo para pagar. El pedido se cancela solo.',
} as const;

const DEADLINE = new Intl.DateTimeFormat('es-MX', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

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

/** Encargo con tarjeta sin cobrar: no hay `pago` hasta que el negocio lo acepte. */
export function isAwaitingAcceptance(order: OrderDetail): boolean {
  return (
    order.metodo_pago === 'stripe' &&
    order.estado === 'por_aceptar' &&
    order.pago?.payment_status !== 'confirmado'
  );
}

/** Encargo con tarjeta que el negocio ya aceptó: solo esos traen `pagar_antes_de`. */
export function isAcceptedOrderToPay(order: OrderDetail): boolean {
  return order.metodo_pago === 'stripe' && order.estado === 'por_cobrar' && Boolean(order.pagar_antes_de);
}

export function isPaymentWindowExpired(order: OrderDetail, now: number = Date.now()): boolean {
  return isAcceptedOrderToPay(order) && new Date(order.pagar_antes_de ?? 0).getTime() <= now;
}

/** El pago del encargo se abre con un POST: el intento de un GET no trae `client_secret`. */
export function canPayAcceptedOrder(order: OrderDetail, now: number = Date.now()): boolean {
  if (!isAcceptedOrderToPay(order) || isPaymentWindowExpired(order, now)) return false;
  const status = order.pago?.payment_status;
  return !status || status === 'pendiente_pago';
}

export function stripePaymentCopy(order: OrderDetail, now: number = Date.now()): string {
  if (order.metodo_pago !== 'stripe') return '';
  if (isStripePaymentConfirmedByBackend(order)) return STRIPE_COPY.confirmed;
  const status: StripePaymentStatus | undefined = order.pago?.payment_status;
  if (order.estado === 'por_aceptar') {
    return status === 'confirmado' ? STRIPE_COPY.paidAwaitingAcceptance : STRIPE_COPY.awaitingAcceptance;
  }
  if (status === 'processing' || status === 'requires_action') return STRIPE_COPY.processing;
  if (isPaymentWindowExpired(order, now)) return STRIPE_COPY.paymentWindowExpired;
  if (status === 'fallido') return STRIPE_COPY.failed;
  if (status === 'cancelado') return STRIPE_COPY.canceled;
  if (isAcceptedOrderToPay(order)) {
    const deadline = DEADLINE.format(new Date(order.pagar_antes_de ?? 0));
    return `El negocio aceptó tu pedido. Tienes hasta ${deadline} para pagar; empiezan a prepararlo cuando pagues.`;
  }
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
