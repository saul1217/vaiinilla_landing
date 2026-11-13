// Modo Hotel del huésped: modelos, lectura de las respuestas del servidor y textos. Espejo de
// `domain/hotel/HotelModels.kt`, `data/hotel/HotelJson.kt` y los helpers de `ui/hotel/guest` (Android).
// Contrato: `docs/hotel.md` del backend. Todo lo que el servidor puede omitir es opcional para que un
// campo que cambie no tumbe la pantalla. El dinero viaja como texto con punto decimal ("350.00").
import { VaiinillaApiError, errorMessage } from './api-error';
import { centsToMoney, moneyToCents } from './money';

export const STAY_CODE_LENGTH = 6;

/** Lo que el dueño configura del hotel (`GET hotel/configuracion` o `ajustes` de la estancia). */
export interface HotelConfig {
  active: boolean;
  chargeToRoom: boolean;
  cardAtOrderEnabled: boolean;
  kitchenFrom: string | null;
  kitchenTo: string | null;
  requestsEnabled: boolean;
  doNotDisturbEnabled: boolean;
  lateCheckoutTime: string | null;
  lateCheckoutPrice: string | null;
  checkoutTime: string | null;
}

export const DEFAULT_HOTEL_CONFIG: HotelConfig = {
  active: true,
  chargeToRoom: true,
  cardAtOrderEnabled: false,
  kitchenFrom: null,
  kitchenTo: null,
  requestsEnabled: true,
  doNotDisturbEnabled: true,
  lateCheckoutTime: null,
  lateCheckoutPrice: null,
  checkoutTime: null,
};

export type StayStatus = 'reservada' | 'en_casa' | 'salio' | 'cancelada';
export type ChargeCategory = 'minibar' | 'spa' | 'salida_tardia' | 'otro';
export type RequestType = 'toallas' | 'almohadas' | 'limpieza' | 'cargador' | 'salida_tardia' | 'otro';
export type RequestStatus = 'pendiente' | 'tomada' | 'resuelta' | 'cancelada';

export const CHARGE_LABEL: Record<ChargeCategory, string> = {
  minibar: 'Minibar',
  spa: 'Spa',
  salida_tardia: 'Salida tardía',
  otro: 'Otro',
};

export const REQUEST_LABEL: Record<RequestType, string> = {
  toallas: 'Toallas',
  almohadas: 'Almohadas',
  limpieza: 'Limpieza',
  cargador: 'Cargador',
  salida_tardia: 'Salida tardía',
  otro: 'Otra cosa',
};

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  pendiente: 'Pendiente',
  tomada: 'En camino',
  resuelta: 'Resuelta',
  cancelada: 'Cancelada',
};

export interface StayCharge {
  id: string;
  concept: string;
  amount: string;
  category: ChargeCategory;
  createdAt: string | null;
}

export interface StayOrder {
  orderId: string;
  folio: string | null;
  total: string;
  state: string;
  createdAt: string | null;
  itemsSummary: string | null;
  /** Va a la cuenta de la habitación y todavía no se cobra (se cobra en el check-out). */
  pendingPayment: boolean;
}

export interface StayAccount {
  nightsTotal: string | null;
  chargesTotal: string | null;
  ordersTotal: string | null;
  total: string | null;
  pendingOrders: number;
}

export interface Stay {
  id: string;
  guestName: string;
  roomId: number | null;
  roomName: string | null;
  floor: number | null;
  checkIn: string;
  checkOut: string;
  nightlyRate: string | null;
  status: StayStatus;
  nights: number;
  charges: StayCharge[];
  orders: StayOrder[];
  doNotDisturb: boolean;
  expectedDeparture: string | null;
  account: StayAccount | null;
  totalCharged: string | null;
  settings: HotelConfig | null;
}

export interface HotelRequest {
  id: string;
  type: RequestType;
  quantity: number;
  note: string | null;
  status: RequestStatus;
  createdAt: string | null;
}

// region Lectura

type Json = Record<string, unknown>;

function record(value: unknown): Json {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {};
}

function text(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

function int(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return null;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** «HH:mm» de una hora que el servidor puede mandar con segundos. */
function hour(value: unknown): string | null {
  const raw = text(value);
  return raw ? raw.slice(0, 5) : null;
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

const STAY_STATUSES = ['reservada', 'en_casa', 'salio', 'cancelada'] as const;
const CHARGE_CATEGORIES = ['minibar', 'spa', 'salida_tardia', 'otro'] as const;
const REQUEST_TYPES = ['toallas', 'almohadas', 'limpieza', 'cargador', 'salida_tardia', 'otro'] as const;
const REQUEST_STATUSES = ['pendiente', 'tomada', 'resuelta', 'cancelada'] as const;

export function parseHotelConfig(payload: unknown): HotelConfig {
  const raw = record(payload);
  return {
    active: bool(raw.activo, true),
    chargeToRoom: bool(raw.cargo_habitacion_activo, true),
    cardAtOrderEnabled: bool(raw.tarjeta_al_pedir, false),
    kitchenFrom: hour(raw.cocina_desde),
    kitchenTo: hour(raw.cocina_hasta),
    requestsEnabled: bool(raw.solicitudes_activas, true),
    doNotDisturbEnabled: bool(raw.no_molestar_activo, true),
    lateCheckoutTime: hour(raw.salida_tardia_hora),
    lateCheckoutPrice: text(raw.salida_tardia_precio),
    checkoutTime: hour(raw.hora_checkout),
  };
}

function parseCharge(payload: unknown): StayCharge {
  const raw = record(payload);
  return {
    id: text(raw.id) ?? '',
    concept: text(raw.concepto) ?? '',
    amount: text(raw.monto) ?? '0.00',
    category: oneOf(raw.categoria, CHARGE_CATEGORIES, 'otro'),
    createdAt: text(raw.creado_en),
  };
}

function parseStayOrder(payload: unknown): StayOrder {
  const raw = record(payload);
  return {
    orderId: text(raw.id) ?? '',
    folio: text(raw.folio),
    total: text(raw.total) ?? '0.00',
    state: text(raw.estado) ?? '',
    createdAt: text(raw.creado_en),
    itemsSummary: text(raw.items_resumen),
    pendingPayment: raw.por_cobrar === true,
  };
}

function parseAccount(payload: unknown): StayAccount | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = record(payload);
  return {
    nightsTotal: text(raw.noches_total),
    chargesTotal: text(raw.cargos_total),
    ordersTotal: text(raw.pedidos_total),
    total: text(raw.total),
    pendingOrders: int(raw.pedidos_pendientes) ?? 0,
  };
}

export function parseStay(payload: unknown): Stay {
  const raw = record(payload);
  return {
    id: text(raw.id) ?? '',
    guestName: text(raw.huesped) ?? '',
    roomId: int(raw.espacio_id),
    roomName: text(raw.espacio_nombre),
    floor: int(raw.piso),
    checkIn: text(raw.entrada) ?? '',
    checkOut: text(raw.salida) ?? '',
    nightlyRate: text(raw.tarifa_noche),
    status: oneOf(raw.estado, STAY_STATUSES, 'en_casa'),
    nights: int(raw.noches) ?? 1,
    charges: Array.isArray(raw.cargos) ? raw.cargos.map(parseCharge) : [],
    orders: Array.isArray(raw.pedidos) ? raw.pedidos.map(parseStayOrder) : [],
    doNotDisturb: raw.no_molestar === true,
    expectedDeparture: text(raw.salida_prevista),
    account: parseAccount(raw.cuenta),
    totalCharged: text(raw.total_cobrado),
    settings: raw.ajustes && typeof raw.ajustes === 'object' ? parseHotelConfig(raw.ajustes) : null,
  };
}

export function parseHotelRequest(payload: unknown): HotelRequest {
  const raw = record(payload);
  return {
    id: text(raw.id) ?? '',
    type: oneOf(raw.tipo, REQUEST_TYPES, 'otro'),
    quantity: int(raw.cantidad) ?? 1,
    note: text(raw.nota),
    status: oneOf(raw.estado, REQUEST_STATUSES, 'pendiente'),
    createdAt: text(raw.creado_en),
  };
}

export function parseHotelRequests(payload: unknown): HotelRequest[] {
  return Array.isArray(payload) ? payload.map(parseHotelRequest) : [];
}

export function isOpenRequest(request: HotelRequest): boolean {
  return request.status === 'pendiente' || request.status === 'tomada';
}

// endregion

// region Solicitudes (H05)

/** Lo que se pide por cantidad; lo demás se pide o no se pide. */
export const QUANTITY_REQUESTS: readonly RequestType[] = ['toallas', 'almohadas', 'cargador'];
export const MAX_REQUEST_QUANTITY = 4;

export const REQUEST_OPTIONS: ReadonlyArray<{ type: RequestType; title: string; subtitle: string }> = [
  { type: 'toallas', title: 'Toallas', subtitle: 'Baño o alberca' },
  { type: 'almohadas', title: 'Almohadas', subtitle: 'Suaves o firmes' },
  { type: 'limpieza', title: 'Limpieza', subtitle: 'Limpiamos tu habitación hoy' },
  { type: 'cargador', title: 'Cargador o plancha', subtitle: 'Te lo llevamos' },
];

/** Un toque: lo que va por cantidad suma uno (hasta cuatro y vuelve a cero); lo demás se prende y se apaga. */
export function tapRequest(
  picked: Partial<Record<RequestType, number>>,
  type: RequestType,
): Partial<Record<RequestType, number>> {
  const current = picked[type] ?? 0;
  const next = QUANTITY_REQUESTS.includes(type)
    ? current >= MAX_REQUEST_QUANTITY
      ? 0
      : current + 1
    : current > 0
      ? 0
      : 1;
  const copy = { ...picked };
  if (next === 0) delete copy[type];
  else copy[type] = next;
  return copy;
}

export function lateCheckoutNote(config: HotelConfig): string {
  const until = config.lateCheckoutTime ? `Hasta las ${config.lateCheckoutTime}` : 'Pide más tiempo';
  const price = config.lateCheckoutPrice ? `${moneyLabel(config.lateCheckoutPrice)} extra` : null;
  return [until, price].filter(Boolean).join(' · ');
}

// endregion

// region Cuenta (H06)

export interface AccountLine {
  title: string;
  detail: string | null;
  amount: string;
}

export function isClosedStay(stay: Stay): boolean {
  return stay.status === 'salio';
}

function cents(value: string | null | undefined): bigint | null {
  if (!value) return null;
  return moneyToCents(value) ?? moneyToCents(Number(value).toFixed(2));
}

/**
 * El servidor lista todos los pedidos de la estancia, pero su cuenta solo suma los que van a la
 * habitación y siguen sin cobrar (`por_cobrar`).
 */
function billedOrders(stay: Stay): StayOrder[] {
  return stay.account && !isClosedStay(stay) ? stay.orders.filter((order) => order.pendingPayment) : stay.orders;
}

export function accountLines(stay: Stay): AccountLine[] {
  const orders = billedOrders(stay).map((order) => ({
    title: order.itemsSummary ?? (order.folio ? `Room service · pedido ${order.folio}` : 'Room service'),
    detail: [moment(order.createdAt), 'room service'].filter(Boolean).join(' · '),
    amount: order.total,
  }));
  const charges = stay.charges.map((charge) => ({
    title: charge.concept,
    detail:
      [moment(charge.createdAt), charge.category !== 'otro' ? CHARGE_LABEL[charge.category] : null]
        .filter(Boolean)
        .join(' · ') || null,
    amount: charge.amount,
  }));
  return [...orders, ...charges];
}

/** Lo cargado a la habitación (room service y cargos de recepción); las noches van aparte. */
export function roomCharges(stay: Stay): string {
  const orders = cents(stay.account?.ordersTotal);
  const charges = cents(stay.account?.chargesTotal);
  if (orders !== null && charges !== null) return centsToMoney(orders + charges);
  const sum = accountLines(stay).reduce((total, line) => total + (cents(line.amount) ?? 0n), 0n);
  return centsToMoney(sum);
}

export function stayCost(stay: Stay): string | null {
  const nights = cents(stay.account?.nightsTotal);
  if (nights !== null) return centsToMoney(nights);
  const rate = cents(stay.nightlyRate);
  return rate === null ? null : centsToMoney(rate * BigInt(stay.nights));
}

/** En una estancia abierta, lo cargado; en una cerrada, lo que se cobró en el check-out. */
export function accountHeadline(stay: Stay): { label: string; amount: string } {
  const charged = cents(stay.totalCharged);
  if (isClosedStay(stay) && charged !== null) return { label: 'Total cobrado', amount: centsToMoney(charged) };
  return { label: 'Cargos a la habitación', amount: roomCharges(stay) };
}

// endregion

// region Textos

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function dateParts(iso: string | null | undefined): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** «9 de nov»; null si la fecha no se lee. */
export function shortDate(iso: string | null | undefined): string | null {
  const date = dateParts(iso);
  return date ? `${date.day} de ${MONTHS_ES[date.month - 1]}` : null;
}

/** «del 6 al 9 de nov», o «del 30 oct al 2 de nov» si cruza de mes. */
export function stayRange(checkIn: string | null | undefined, checkOut: string | null | undefined): string | null {
  const from = dateParts(checkIn);
  const to = dateParts(checkOut);
  if (!from || !to) return null;
  const toLabel = `${to.day} de ${MONTHS_ES[to.month - 1]}`;
  return from.month === to.month && from.year === to.year
    ? `del ${from.day} al ${toLabel}`
    : `del ${from.day} ${MONTHS_ES[from.month - 1]} al ${toLabel}`;
}

/** «9 nov, 14:05» en la hora del teléfono; null si no hay instante. */
function moment(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const time = date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date.getDate()} ${MONTHS_ES[date.getMonth()]}, ${time}`;
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? '';
}

/** «$350», o «$350.50» con centavos. */
export function moneyLabel(value: string | null | undefined): string {
  const amount = cents(value);
  if (amount === null) return '—';
  const plain = centsToMoney(amount);
  return plain.endsWith('.00') ? `$${plain.slice(0, -3)}` : `$${plain}`;
}

/** El mensaje que ve el huésped: los errores del hotel con sus palabras, los demás con el texto general. */
export function hotelErrorMessage(error: unknown, fallback = 'No se pudo completar. Intenta de nuevo.'): string {
  const code = error instanceof VaiinillaApiError ? error.code : null;
  switch (code) {
    case 'ROOM_REQUIRES_STAY':
      return 'Primero escribe el código de estancia que te dio recepción.';
    case 'STAY_NOT_FOUND':
      return 'Ese código no coincide o ya venció. Revísalo con recepción.';
    case 'ROOM_CHARGE_DISABLED':
      return 'Este hotel no carga pedidos a la habitación. Elige otra forma de pago.';
    case 'CARD_AT_ORDER_DISABLED':
      return 'Este hotel no cobra con tarjeta al pedir.';
    case 'OUTSIDE_ORDER_HOURS':
      return 'La cocina no recibe pedidos a esta hora.';
    case 'REQUESTS_DISABLED':
      return 'Este hotel no recibe solicitudes desde la app.';
    case 'DND_DISABLED':
      return 'Este hotel no tiene «No molestar» desde la app.';
    case 'LATE_CHECKOUT_UNAVAILABLE':
      return 'La salida tardía no está disponible.';
    case 'RATE_LIMITED':
      return 'Demasiados intentos seguidos. Espera un momento y vuelve a escribir tu código.';
    case 'STAY_GUEST_LIMIT':
      return 'Esta habitación ya tiene ligadas todas las cuentas que permite el hotel. Pídelo en recepción.';
    default:
      // Un fallo de red o del servidor ya trae su texto amable; cualquier otra cosa usa el general.
      return error instanceof VaiinillaApiError ? errorMessage(error) : fallback;
  }
}

// endregion
