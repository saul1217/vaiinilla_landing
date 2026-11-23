import { VaiinillaApiError } from './api-error';
import { homeCardCharge, type HomePayment } from './home-delivery';
import { centsToMoney, formatMoney, moneyToCents } from './money';

/**
 * Mínimo por cobro con tarjeta (cafeterías, back #265). GET /estado-operativo publica
 * `tarjeta_minimo` como texto decimal ("30.00") o null cuando el negocio no tiene mínimo.
 * La regla es estricta: la tarjeta pasa solo si el cobro es MAYOR que el mínimo ($30.00 no
 * pasa, $30.01 sí). Todo se compara en centavos. El servidor sigue siendo la autoridad y
 * responde 422 CARD_MIN_AMOUNT aunque la UI no lo detecte.
 */
export function cardMinimumCents(minimum: string | null | undefined): bigint | null {
  if (typeof minimum !== 'string') return null;
  return moneyToCents(minimum.trim());
}

/** Verdadero solo si hay mínimo y el cobro con tarjeta no lo supera. Sin datos, no se bloquea. */
export function cardBelowMinimum(amount: string | null | undefined, minimum: string | null | undefined): boolean {
  const minimumCents = cardMinimumCents(minimum);
  if (minimumCents === null || typeof amount !== 'string') return false;
  const amountCents = moneyToCents(amount);
  if (amountCents === null) return false;
  return amountCents <= minimumCents;
}

/**
 * A domicilio (decisión de Kikin, 18-nov, back #265): la tarjeta cobra el total con envío, y con
 * anticipo solo esa parte. Devuelve las formas de pago con tarjeta cuyo cobro no supera el mínimo.
 * Sin mínimo o sin total no se bloquea ninguna: el servidor sigue respondiendo 422.
 */
export function homePaymentsBelowMinimum(
  offered: HomePayment[],
  cardTotal: string | null,
  depositPercent: number | null,
  minimum: string | null | undefined,
): HomePayment[] {
  return offered.filter(
    (payment) => payment !== 'on_arrival' && cardBelowMinimum(homeCardCharge(payment, cardTotal, depositPercent), minimum),
  );
}

/** "$30.01": el primer cobro que sí acepta la tarjeta. */
export function cardFromLabel(minimum: string): string {
  const cents = cardMinimumCents(minimum);
  return cents === null ? formatMoney(minimum) : `$${centsToMoney(cents + 1n)}`;
}

/** Subtítulo de la opción «Tarjeta» (o «Anticipo») cuando el cobro no llega al mínimo. */
export function cardMinimumNotice(minimum: string, label = 'Tarjeta'): string {
  return `${label} desde ${cardFromLabel(minimum)}: el cobro debe ser mayor a ${formatMoney(minimum)}.`;
}

/** Mensaje para el cliente: con caja disponible se le ofrece; si no, que agregue productos. */
export function cardMinimumMessage(minimum: string, cashAvailable = true, cashLabel = 'pago en caja'): string {
  const base = `El cobro con tarjeta debe ser mayor a ${formatMoney(minimum)} (tarjeta desde ${cardFromLabel(minimum)}).`;
  return cashAvailable
    ? `${base} Elige ${cashLabel} o agrega productos.`
    : `${base} Agrega productos para continuar.`;
}

interface CardMinimumDetails {
  minimo?: unknown;
  efectivo_disponible?: unknown;
}

function firstDetails(details: unknown): CardMinimumDetails | null {
  const first: unknown = Array.isArray(details) ? (details as unknown[])[0] : details;
  return first && typeof first === 'object' ? first : null;
}

/**
 * Texto para un 422 CARD_MIN_AMOUNT, o null si el error es otro. Solo depende de `code` y
 * `details.minimo`; `efectivo_disponible: false` cambia la sugerencia. Sin `minimo` legible
 * se usa el mensaje del servidor.
 */
export function cardMinimumErrorMessage(error: unknown): string | null {
  if (!(error instanceof VaiinillaApiError) || error.code !== 'CARD_MIN_AMOUNT') return null;
  const details = firstDetails(error.details);
  const minimum = typeof details?.minimo === 'string' ? details.minimo : null;
  if (!minimum || cardMinimumCents(minimum) === null) return error.message;
  return cardMinimumMessage(minimum, details?.efectivo_disponible !== false);
}
