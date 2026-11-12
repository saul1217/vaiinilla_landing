// Reglas del pedido a domicilio, las mismas de Android (HomeCheckoutRules y DeliveryAddress en
// vaiinilla-android/domain/model). Contrato del back: docs/reposteria-domicilio.md.
import type {
  CreateOrderInput,
  DeliveryInput,
  HomeDeliveryQuote,
  OperationalStatus,
  PaymentMethod,
} from '../types/api';
import { centsToMoney, formatAmount, moneyToCents } from './money';

/** Cómo paga el cliente un pedido a domicilio. */
export type HomePayment = 'card' | 'deposit' | 'on_arrival';

/** Lo que el negocio ofrece a domicilio, sacado del estado operativo. */
export interface HomeDeliveryOffer {
  fee: string;
  minimum: string | null;
  radiusKm: string | null;
  payOnArrival: boolean;
  depositPercent: number | null;
  transferDetails: string | null;
}

/** Lo que llena el cliente para que le lleven el pedido. */
export interface HomeAddressDraft {
  /** Calle con número y el resto de la dirección. */
  address: string;
  reference: string;
  phone: string;
  lat: number | null;
  lng: number | null;
}

export const EMPTY_HOME_ADDRESS: HomeAddressDraft = { address: '', reference: '', phone: '', lat: null, lng: null };

/** Lo que pone el mapa cuando no encuentra la calle de ese punto. */
export const LOCATION_PREFIX = 'Ubicación ';
const ADDRESS_MAX = 160;
const REFERENCE_MAX = 200;

/** "40", "40.5" o 40 del back a "40.00"; null si no es un monto. */
export function normalizeMoney(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [pesos = '0', cents = ''] = text.split('.');
  return `${BigInt(pesos)}.${cents.padEnd(2, '0')}`;
}

/** El reparto del negocio; null si no reparte (o el back no manda el bloque). */
export function homeDeliveryOffer(status: OperationalStatus | null): HomeDeliveryOffer | null {
  const reparto = status?.reparto;
  if (!reparto || reparto.activo !== true) return null;
  const fee = normalizeMoney(reparto.costo);
  if (fee === null) return null;
  const radius = reparto.radio_km == null ? '' : String(reparto.radio_km).trim();
  return {
    fee,
    minimum: normalizeMoney(reparto.minimo),
    radiusKm: radius || null,
    payOnArrival: status?.permite_contra_entrega === true,
    depositPercent: typeof status?.anticipo_porcentaje === 'number' ? status.anticipo_porcentaje : null,
    transferDetails: status?.datos_transferencia?.trim() || null,
  };
}

/** Las formas de pago que ofrece el negocio, en el orden en que se muestran (como Android). */
export function homePayments(offer: HomeDeliveryOffer, acceptsCard: boolean): HomePayment[] {
  const out: HomePayment[] = [];
  if (acceptsCard) out.push('card');
  if (acceptsCard && offer.depositPercent != null) out.push('deposit');
  if (offer.payOnArrival) out.push('on_arrival');
  return out;
}

/** La elegida si se ofrece; si no, la primera que se ofrece. Null si no hay ninguna. */
export function effectiveHomePayment(chosen: HomePayment | null, offered: HomePayment[]): HomePayment | null {
  return chosen && offered.includes(chosen) ? chosen : (offered[0] ?? null);
}

/** Con qué método viaja al back: al recibir es efectivo, lo demás tarjeta. */
export function homePaymentMethod(payment: HomePayment): PaymentMethod {
  return payment === 'on_arrival' ? 'efectivo' : 'stripe';
}

const NUMBER = /\d|\bs\/?n\b|sin n[uú]mero/i;

function parts(address: string): string[] {
  return address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function isStreet(part: string): boolean {
  return /\p{L}/u.test(part) && !part.startsWith(LOCATION_PREFIX.trim()) && NUMBER.test(part);
}

/** La primera parte si es una calle con número («Aldama 1408», «Roble s/n»); vacío si no. */
export function streetOf(address: string): string {
  const first = parts(address)[0];
  return first && isStreet(first) ? first : '';
}

/** Lo demás de la dirección (colonia, CP, ciudad), sin la calle ni las coordenadas sueltas. */
export function areaOf(address: string): string[] {
  if (address.trim().startsWith(LOCATION_PREFIX.trim())) return [];
  const all = parts(address);
  const first = all[0];
  return first && isStreet(first) ? all.slice(1) : all;
}

/** La calle que escribió la persona delante del resto; quita lo que la calle ya repite. */
export function joinStreet(street: string, area: string[]): string {
  const typed = street.trim();
  const rest = area.filter((part) => !(typed && typed.toLowerCase().startsWith(part.toLowerCase())));
  return [typed, ...rest].filter(Boolean).join(', ').slice(0, ADDRESS_MAX);
}

export function phoneProblem(phone: string): string | null {
  return phone.replace(/\D/g, '').length === 10 ? null : 'Escribe un teléfono de 10 dígitos para que te avisen.';
}

/** Lo mínimo para que el negocio llegue y avise. */
export function addressProblem(draft: HomeAddressDraft): string | null {
  if (!draft.address.trim()) return 'Escribe la calle, el número y la colonia.';
  if (!streetOf(draft.address)) return 'Escribe la calle y el número de tu casa.';
  return phoneProblem(draft.phone);
}

/** Lo que falta para poder pedir a domicilio; null si ya se puede. */
export function homeCheckoutProblem(input: {
  draft: HomeAddressDraft;
  quote: HomeDeliveryQuote | null;
  offer: HomeDeliveryOffer;
  payments: HomePayment[];
  /**
   * Los productos solos, sin el envío, al precio del método elegido: con tarjeta ya trae la
   * comisión. Así compara el back el mínimo (`totales.subtotalCents` en pedidos.service.js).
   */
  subtotal: string | null;
}): string | null {
  if (input.payments.length === 0) return 'Este negocio aún no tiene cómo cobrar a domicilio.';
  const address = addressProblem(input.draft);
  if (address) return address;
  if (input.draft.lat == null || input.draft.lng == null || !input.quote) {
    return 'Elige en el mapa dónde te lo llevan para calcular el envío.';
  }
  if (!input.quote.llega) return 'Esta dirección queda fuera de la zona de entrega.';
  const minimum = moneyToCents(normalizeMoney(input.quote.minimo) ?? input.offer.minimum ?? '');
  const subtotal = moneyToCents(input.subtotal ?? '') ?? 0n;
  if (minimum !== null && minimum > 0n && subtotal < minimum) {
    return `El pedido mínimo a domicilio es de ${formatAmount(centsToMoney(minimum))}.`;
  }
  return null;
}

/** El envío que se enseña: el de la cotización, o el fijo del negocio mientras no hay. */
export function homeDeliveryFee(offer: HomeDeliveryOffer, quote: HomeDeliveryQuote | null): string {
  return normalizeMoney(quote?.costo) ?? offer.fee;
}

/** Productos más envío. */
export function totalWithFee(subtotal: string | null, fee: string | null): string | null {
  if (!subtotal) return null;
  if (!fee) return subtotal;
  const a = moneyToCents(subtotal);
  const b = moneyToCents(fee);
  return a === null || b === null ? subtotal : centsToMoney(a + b);
}

/** Lo que cuesta el envío en una etiqueta corta. */
export function feeLabel(fee: string): string {
  return moneyToCents(fee) === 0n ? 'Envío gratis' : `Envío ${formatAmount(fee)}`;
}

/** Las claves de domicilio que se suman al pedido. Solo viajan las que se usan (el back las valida). */
export function homeDeliveryOrderFields(
  draft: HomeAddressDraft,
  payment: HomePayment,
): Pick<CreateOrderInput, 'entrega' | 'al_recibir' | 'con_anticipo'> {
  const entrega: DeliveryInput = {
    direccion: draft.address.trim().slice(0, ADDRESS_MAX),
    telefono: draft.phone.replace(/\D/g, ''),
  };
  const reference = draft.reference.trim().slice(0, REFERENCE_MAX);
  if (reference) entrega.referencia = reference;
  if (draft.lat != null && draft.lng != null) {
    entrega.lat = draft.lat;
    entrega.lng = draft.lng;
  }
  return {
    entrega,
    ...(payment === 'on_arrival' ? { al_recibir: true } : {}),
    ...(payment === 'deposit' ? { con_anticipo: true } : {}),
  };
}

/** "Ubicación 28.63210, -106.08890" cuando el mapa no encuentra calle en ese punto. */
export function locationLabel(lat: number, lng: number): string {
  return `${LOCATION_PREFIX}${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/** Dos puntos a menos de ~1 m son el mismo (el mapa se detiene con ruido). */
export function samePoint(a: { lat: number; lng: number } | null, b: { lat: number; lng: number } | null): boolean {
  if (!a || !b) return false;
  return Math.abs(a.lat - b.lat) < 1e-5 && Math.abs(a.lng - b.lng) < 1e-5;
}
