import { appEnvironment, type AppEnvironment } from './env';
import { centsToMoney, moneyToCents } from './money';
import {
  isDevelopmentApiUrl,
  isProductionApiUrl,
  isSecretStripeMaterial,
  stripeKeyMode,
  stripePublishableKey,
} from './stripe-public';
import type { CardReload, WalletData } from '../types/api';

/** Los montos rápidos de la recarga, los mismos que Android (ChildReloadModel.QUICK_AMOUNTS). */
export const QUICK_RELOAD_AMOUNTS = [100, 200, 300, 500] as const;

/** Mientras el QR de Caja está a la vista se pregunta por el saldo cada 4 s (Android: CODE_POLL_MS). */
export const CASH_RELOAD_POLL_MS = 4_000;

/** Tras pagar con tarjeta se pregunta por la recarga cada 3 s hasta 90 s (Android: StripePaymentConfirmation). */
export const CARD_RELOAD_POLL_MS = 3_000;
export const CARD_RELOAD_MAX_POLLS = 31;

export const CARD_RELOAD_TEST_ONLY_COPY = 'La recarga con tarjeta solo está disponible en modo de prueba.';

export type CardReloadStatus = 'awaiting' | 'credited' | 'failed' | 'canceled' | 'other';

/** Los estados del backend en palabras de la app (Android: CardReloadStatus.fromWire). */
export function cardReloadStatus(estado: string): CardReloadStatus {
  switch (estado) {
    case 'pendiente_pago':
    case 'creada':
    case 'pendiente':
      return 'awaiting';
    case 'acreditada':
      return 'credited';
    case 'fallida':
      return 'failed';
    case 'cancelada':
      return 'canceled';
    default:
      return 'other';
  }
}

/**
 * Lo que escribe la persona a "200.00": hasta 6 cifras y 2 decimales, coma o punto. `null` si no es un monto.
 */
export function parseReloadAmount(text: string): string | null {
  const clean = text.trim().replace(',', '.').replace(/\.$/, '');
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(clean)) return null;
  const [pesos = '0', cents = ''] = clean.split('.');
  const money = `${BigInt(pesos)}.${cents.padEnd(2, '0')}`;
  const value = moneyToCents(money);
  if (value === null || value <= 0n) return null;
  return money;
}

export interface ReloadRange {
  minima: string | null;
  maxima: string | null;
}

export function reloadRangeOf(wallet: WalletData | null | undefined): ReloadRange | null {
  const range = wallet?.recarga_tarjeta;
  if (!range || (!range.minima && !range.maxima)) return null;
  return { minima: range.minima ?? null, maxima: range.maxima ?? null };
}

/** «De $50 a $2,000»; el mismo aviso que el backend (WALLET_RECHARGE_OUT_OF_RANGE). */
export function reloadRangeLabel(range: ReloadRange | null): string | null {
  if (!range) return null;
  if (range.minima && range.maxima) return `La recarga debe ser de $${range.minima} a $${range.maxima}.`;
  if (range.minima) return `La recarga mínima es de $${range.minima}.`;
  if (range.maxima) return `La recarga máxima es de $${range.maxima}.`;
  return null;
}

/** Qué impide recargar ese monto; `null` si se puede. */
export function reloadAmountProblem(text: string, range: ReloadRange | null): string | null {
  if (!text.trim()) return null;
  const amount = parseReloadAmount(text);
  if (!amount) return 'Escribe un monto válido: hasta 6 cifras y 2 decimales.';
  const cents = moneyToCents(amount)!;
  const min = range?.minima ? moneyToCents(range.minima) : null;
  const max = range?.maxima ? moneyToCents(range.maxima) : null;
  if ((min !== null && cents < min) || (max !== null && cents > max)) return reloadRangeLabel(range);
  return null;
}

/** Lo que cobra Stripe además del monto (su costo y la comisión); `null` si no hay extra. */
export function reloadExtraCharge(reload: Pick<CardReload, 'monto' | 'total_cobrado_cents'>): string | null {
  const amount = moneyToCents(reload.monto);
  if (amount === null) return null;
  const extra = BigInt(Math.round(reload.total_cobrado_cents)) - amount;
  return extra > 0n ? centsToMoney(extra) : null;
}

export function centsLabel(cents: number): string {
  return centsToMoney(BigInt(Math.round(cents)));
}

/**
 * La recarga con tarjeta solo se ofrece en modo de prueba: ambiente development, API que no es la de
 * producción y, si la web trae clave de Stripe, que sea `pk_test_`. Así nunca se crea un cobro real.
 */
export function isCardReloadTestMode(options: {
  environment?: AppEnvironment;
  apiUrl: string;
  envKey?: string | null;
}): boolean {
  const environment = options.environment ?? appEnvironment;
  if (environment !== 'development') return false;
  if (isProductionApiUrl(options.apiUrl)) return false;
  if (!isDevelopmentApiUrl(options.apiUrl) && !options.apiUrl.startsWith('http://127.0.0.1') && !options.apiUrl.startsWith('http://localhost')) {
    return false;
  }
  const envKey = options.envKey === undefined ? stripePublishableKey() : options.envKey?.trim();
  if (envKey) {
    if (isSecretStripeMaterial(envKey)) return false;
    if (stripeKeyMode(envKey) !== 'test') return false;
  }
  return true;
}

/** La clave con la que se abre Stripe para la recarga: solo `pk_test_`, nunca una live ni una secreta. */
export function resolveTestStripeKey(received: string | null | undefined, envKey: string | null | undefined): string {
  const key = received?.trim() || envKey?.trim() || '';
  if (!key || isSecretStripeMaterial(key) || stripeKeyMode(key) !== 'test') {
    throw new Error(CARD_RELOAD_TEST_ONLY_COPY);
  }
  return key;
}

export type CardReloadOutcome =
  | { kind: 'credited'; reload: CardReload }
  | { kind: 'failed'; reload: CardReload }
  | { kind: 'in_review' };

/**
 * El pago de Stripe nunca acredita por sí mismo: se pregunta al backend hasta que diga "acreditada" o
 * "fallida"/"cancelada". Si se acaba el tiempo, queda en revisión (no se debe pagar otra vez).
 */
export async function waitForCardReload(
  fetchReload: () => Promise<CardReload>,
  {
    intervalMs = CARD_RELOAD_POLL_MS,
    maxPolls = CARD_RELOAD_MAX_POLLS,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    isActive = () => true,
  }: {
    intervalMs?: number;
    maxPolls?: number;
    sleep?: (ms: number) => Promise<void>;
    isActive?: () => boolean;
  } = {},
): Promise<CardReloadOutcome> {
  for (let index = 0; index < maxPolls; index += 1) {
    if (!isActive()) break;
    const reload = await fetchReload().catch(() => null);
    const status = reload ? cardReloadStatus(reload.estado) : null;
    if (reload && status === 'credited') return { kind: 'credited', reload };
    if (reload && (status === 'failed' || status === 'canceled')) return { kind: 'failed', reload };
    if (index < maxPolls - 1) await sleep(intervalMs);
  }
  return { kind: 'in_review' };
}

/** Si el saldo subió mientras el QR estaba a la vista, Caja ya recargó: cuánto entró. */
export function cashReloadArrived(before: string | null | undefined, after: string | null | undefined): string | null {
  if (!before || !after) return null;
  const a = moneyToCents(before);
  const b = moneyToCents(after);
  if (a === null || b === null || b <= a) return null;
  return centsToMoney(b - a);
}

/** Los movimientos con el nombre que les da Android (WalletScreen.movementLabel). */
export function movementLabel(tipo: string, descripcion: string): string {
  switch (tipo) {
    case 'recarga_efectivo':
      return 'Recarga en Caja';
    case 'recarga_stripe':
      return 'Recarga con tarjeta';
    case 'compra':
      return 'Compra';
    case 'cashback':
      return 'Cashback';
    case 'cancelacion':
      return 'Devolución por cancelación';
    case 'devolucion_articulo':
      return 'Devolución de un artículo';
    case 'ajuste':
      return descripcion.trim() || 'Ajuste autorizado';
    default:
      return descripcion;
  }
}

/** Por qué no hay «Recargar» (Android: walletRechargeNote); `null` si se puede. */
export function walletRechargeNote(options: { frozen: boolean; allowsBalance: boolean }): string | null {
  if (options.frozen) return 'Tu saldo está congelado: este negocio no acepta pagos con saldo por ahora.';
  if (!options.allowsBalance) return 'Este lugar ya no recibe recargas de saldo.';
  return null;
}
