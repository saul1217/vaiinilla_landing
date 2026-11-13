// Encargos para otro día: cuándo se pregunta el día y qué días se ofrecen. Las mismas reglas de
// Android (HomeCheckoutRules.asksForDate y dates) y del back (pedidos.service.js: validarProgramado,
// ultimoDiaApartado y primerDiaEntrega, en docs/reposteria-domicilio.md).
import type { CartLine, CatalogProduct, OperationalStatus } from '../types/api';

/** La zona del negocio que usa Android (BusinessTime.DEFAULT_ZONE); el back usa la del establecimiento. */
export const BUSINESS_TIME_ZONE = 'America/Chihuahua';
/** Lo más lejos que se aparta un encargo: 14 días más el de margen (DIAS_ENCARGO_MAX del back). */
const MAX_DAYS = 15;

export interface PreorderOffer {
  daysAhead: number;
  /** "HH:MM" o null. */
  cutoff: string | null;
}

/** Los encargos del negocio; null si el back no manda el bloque (negocio que no toma encargos). */
export function preorderOffer(status: OperationalStatus | null): PreorderOffer | null {
  if (typeof status?.encargos_requieren_aceptar !== 'boolean') return null;
  const days = Number(status.dias_adelanto_pedido ?? 0);
  const cutoff = status.hora_corte_pedido?.trim().slice(0, 5) ?? '';
  return {
    daysAhead: Number.isFinite(days) && days > 0 ? Math.floor(days) : 0,
    cutoff: /^([01]\d|2[0-3]):[0-5]\d$/.test(cutoff) ? cutoff : null,
  };
}

/** Los días de margen que pide el carrito: el producto que más tarda manda. */
export function cartPreparationDays(lines: CartLine[], products: CatalogProduct[]): number {
  const byId = new Map(products.map((product) => [product.id, product]));
  return lines.reduce((max, line) => {
    const days = Number(byId.get(line.productId)?.dias_preparacion ?? 0);
    return Number.isFinite(days) && days > max ? days : max;
  }, 0);
}

/** ¿Hay que elegir día? Si el negocio toma encargos y el carrito no sale hoy, o deja pedir para otro día. */
export function asksForDeliveryDate(offer: PreorderOffer | null, preparationDays: number): boolean {
  return offer !== null && (preparationDays > 0 || offer.daysAhead > 0);
}

/** Fecha de calendario real "AAAA-MM-DD", como `esFechaIso` del back (rechaza el 30 de febrero). */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Hoy y la hora en la zona del negocio: { date: "AAAA-MM-DD", time: "HH:MM" }. */
export function businessNow(now: Date, timeZone = BUSINESS_TIME_ZONE): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/** Los días que se pueden elegir. Pasada la hora de corte, hoy ya no cuenta como día de margen. */
export function deliveryDates(offer: PreorderOffer, preparationDays: number, now: Date, timeZone = BUSINESS_TIME_ZONE): string[] {
  const local = businessNow(now, timeZone);
  let first = preparationDays;
  if (offer.cutoff && local.time >= offer.cutoff) first += 1;
  const last = Math.min(Math.max(offer.daysAhead, first), MAX_DAYS);
  if (first > last) return [];
  const out: string[] = [];
  for (let offset = first; offset <= last; offset += 1) out.push(addDays(local.date, offset));
  return out;
}

const DAY = new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });

/** "Hoy", "Mañana" o "vie 13 nov" (sin el «de» de es-MX, como Android). */
export function deliveryDayLabel(iso: string, today: string): string {
  if (!isIsoDate(iso)) return iso;
  if (iso === today) return 'Hoy';
  if (iso === addDays(today, 1)) return 'Mañana';
  const parts = Object.fromEntries(DAY.formatToParts(new Date(`${iso}T00:00:00Z`)).map((part) => [part.type, part.value]));
  return [parts.weekday, parts.day, parts.month].filter(Boolean).join(' ').replace(/\./g, '');
}

/** De `NEEDS_PREP_TIME`: el primer día que acepta el back (`details[0].desde`), o null. */
export function prepTimeFrom(details: unknown): string | null {
  const first = Array.isArray(details) ? (details[0] as { desde?: unknown } | undefined) : undefined;
  return isIsoDate(first?.desde) ? first.desde : null;
}
