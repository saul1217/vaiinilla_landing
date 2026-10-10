// Renta de canchas del cliente: contrato de /reservas y cuentas de horarios sin red ni DOM.
// Espejo de Reservations.kt (Android). Contrato: vaiinilla_back docs/reservas-cancha.md.
import type { OrderDetail, OrderReservation } from '../types/api';
import { centsToMoney, moneyToCents } from './money';

const MINUTE = 60_000;

export type ReservationStatus = OrderReservation['estado'];

export interface CustomerPrice {
  card: string;
  cashOrBalance: string;
}

export interface BusyInterval {
  start: number;
  end: number;
  /** `reserva` o `turno`. */
  reason: string;
}

/** Foto, descripción y características de la cancha que escribe el dueño. */
export interface CourtProfile {
  description: string | null;
  imageUrl: string | null;
  features: string[];
}

export interface CourtSchedule {
  id: number;
  name: string;
  pricePerHour: string | null;
  customerPricePerHour: CustomerPrice | null;
  rentable: boolean;
  busy: BusyInterval[];
  profile: CourtProfile;
}

/** Horario reservable de un día y lo ocupado de cada cancha. Los instantes van en ms. */
export interface CourtDay {
  date: string;
  today: string;
  timeZone: string;
  opensAt: number;
  closesAt: number;
  blockMinutes: number;
  durations: number[];
  daysAhead: number;
  holdMinutes: number;
  now: number;
  courts: CourtSchedule[];
}

export interface Reservation {
  id: string;
  courtId: number;
  courtName: string | null;
  start: number;
  end: number;
  durationMinutes: number;
  amount: string;
  customerPrice: CustomerPrice | null;
  state: ReservationStatus;
  holdExpiresAt: number | null;
  orderId: string | null;
  channel: string;
  version: number;
}

export type ReservationPaymentMethod = 'saldo' | 'stripe' | 'efectivo';

export interface ReservationPayment {
  reservation: Reservation;
  order: OrderDetail | null;
}

export function isLiveReservation(state: ReservationStatus): boolean {
  return state === 'pendiente_pago' || state === 'confirmada' || state === 'en_curso';
}

// ---------- Lectura del contrato ----------

type Json = Record<string, unknown>;

function obj(value: unknown): Json {
  return value && typeof value === 'object' ? (value as Json) : {};
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function instant(value: unknown, what: string): number {
  const ms = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(ms)) throw new Error(`La API mandó una fecha inválida (${what}).`);
  return ms;
}

function price(value: unknown): CustomerPrice | null {
  const record = obj(value);
  const card = str(record.tarjeta);
  const cash = str(record.efectivo_saldo);
  return card && cash ? { card, cashOrBalance: cash } : null;
}

export function parseCourtDay(raw: unknown): CourtDay {
  const d = obj(raw);
  const courts = Array.isArray(d.canchas) ? d.canchas : [];
  const durations = Array.isArray(d.duraciones_min)
    ? d.duraciones_min.filter((n): n is number => typeof n === 'number')
    : [];
  return {
    date: str(d.fecha) ?? '',
    today: str(d.hoy) ?? '',
    timeZone: str(d.zona_horaria) ?? 'UTC',
    opensAt: instant(d.abre, 'abre'),
    closesAt: instant(d.cierra, 'cierra'),
    blockMinutes: typeof d.bloque_min === 'number' ? d.bloque_min : 30,
    durations: durations.length > 0 ? durations : [90, 180, 270, 360],
    daysAhead: typeof d.dias_adelanto === 'number' ? d.dias_adelanto : 14,
    holdMinutes: typeof d.apartado_min === 'number' ? d.apartado_min : 10,
    now: instant(d.ahora, 'ahora'),
    courts: courts.map((item) => {
      const c = obj(item);
      const space = obj(c.espacio);
      const profile = obj(c.ficha);
      const id = typeof space.id === 'number' ? space.id : Number(space.id);
      return {
        id,
        name: str(space.nombre) ?? `Cancha ${id}`,
        pricePerHour: str(c.precio_hora),
        customerPricePerHour: price(c.precio_hora_cliente),
        rentable: c.rentable === true,
        busy: (Array.isArray(c.ocupado) ? c.ocupado : []).map((slot) => {
          const s = obj(slot);
          return {
            start: instant(s.inicio, 'inicio'),
            end: instant(s.fin, 'fin'),
            reason: str(s.motivo) ?? 'reserva',
          };
        }),
        profile: {
          description: str(profile.descripcion),
          imageUrl: str(profile.imagen_url),
          features: Array.isArray(profile.caracteristicas)
            ? profile.caracteristicas.filter((f): f is string => typeof f === 'string' && f.trim() !== '')
            : [],
        },
      };
    }),
  };
}

export function parseReservation(raw: unknown): Reservation {
  const r = obj(raw);
  const space = obj(r.espacio);
  const hold = str(r.expira_en);
  return {
    id: str(r.id) ?? '',
    courtId: typeof space.id === 'number' ? space.id : Number(space.id),
    courtName: str(space.nombre),
    start: instant(r.inicio, 'inicio'),
    end: instant(r.fin, 'fin'),
    durationMinutes: typeof r.duracion_min === 'number' ? r.duracion_min : 60,
    amount: str(r.monto) ?? '0.00',
    customerPrice: price(r.precio_cliente),
    state: (str(r.estado) as ReservationStatus | null) ?? 'conflicto',
    holdExpiresAt: hold ? instant(hold, 'expira_en') : null,
    orderId: str(r.pedido_id),
    channel: str(r.canal) ?? 'cliente',
    version: typeof r.version === 'number' ? r.version : 1,
  };
}

export function parseReservations(raw: unknown): Reservation[] {
  return Array.isArray(raw) ? raw.map(parseReservation) : [];
}

/** `{ reserva, pedido, cobro }`: el pedido de renta es un pedido normal. */
export function parseReservationPayment(raw: unknown): ReservationPayment {
  const data = obj(raw);
  const order = data.pedido && typeof data.pedido === 'object' ? (data.pedido as OrderDetail) : null;
  return { reservation: parseReservation(data.reserva), order };
}

// ---------- Cuentas de horarios ----------

/** Inicios de `blockMinutes` entre la apertura y el cierre; hoy, solo desde el siguiente bloque. */
export function startTimes(day: CourtDay): number[] {
  const block = day.blockMinutes * MINUTE;
  const shortest = (day.durations.length > 0 ? Math.min(...day.durations) : day.blockMinutes) * MINUTE;
  const result: number[] = [];
  for (let slot = day.opensAt; slot + shortest <= day.closesAt; slot += block) {
    if (slot >= day.now) result.push(slot);
  }
  return result;
}

/** La cancha está libre de `start` a `start + minutes` y dentro del horario. */
export function isFree(day: CourtDay, court: CourtSchedule, start: number, minutes: number): boolean {
  const end = start + minutes * MINUTE;
  if (start < day.opensAt || end > day.closesAt) return false;
  return court.busy.every((slot) => !(slot.start < end && start < slot.end));
}

/**
 * Si la cancha está ocupada en `at`, hasta cuándo, uniendo intervalos pegados (un turno seguido de
 * una reserva no deja un "libre" de cero minutos). `null` si está libre en ese momento.
 */
export function busyUntil(court: CourtSchedule, at: number): number | null {
  let until: number | null = null;
  let cursor = at;
  for (;;) {
    const covering = court.busy
      .filter((slot) => cursor >= slot.start && cursor < slot.end)
      .reduce<number | null>((max, slot) => (max === null || slot.end > max ? slot.end : max), null);
    if (covering === null) return until;
    until = covering;
    cursor = covering;
  }
}

export function availableDurations(day: CourtDay, court: CourtSchedule, start: number): number[] {
  return day.durations.filter((minutes) => isFree(day, court, start, minutes));
}

/** Un inicio se ofrece si cabe al menos la duración más corta. */
export function isStartAvailable(day: CourtDay, court: CourtSchedule, start: number): boolean {
  return availableDurations(day, court, start).length > 0;
}

/** ¿La cancha está libre ahora mismo por al menos la duración más corta? ("Rentar ahora"). */
export function canRentNow(day: CourtDay, court: CourtSchedule): boolean {
  return day.date === day.today && court.rentable && isStartAvailable(day, court, day.now);
}

/** `precio × minutos / 60`, redondeado al centavo, en texto con dos decimales. */
export function amountFor(pricePerHour: string, minutes: number): string | null {
  const cents = moneyToCents(pricePerHour);
  if (cents === null) return null;
  // Mitad hacia arriba, igual que HALF_UP en Android.
  return centsToMoney((cents * BigInt(minutes) * 2n + 60n) / 120n);
}

// ---------- Texto ----------

function formatter(zone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat('es-MX', { timeZone: zone, ...options });
  } catch {
    return new Intl.DateTimeFormat('es-MX', options);
  }
}

export function formatHour(ms: number, zone: string): string {
  return formatter(zone, { hour: '2-digit', minute: '2-digit', hour12: false }).format(ms);
}

/** "YYYY-MM-DD" del instante en la zona del negocio. */
export function localDate(ms: number, zone: string): string {
  const parts = formatter(zone, { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(ms);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Suma días a una fecha "YYYY-MM-DD" sin depender de la zona del navegador. */
export function addDays(date: string, days: number): string {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function dateOnly(date: string): number {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d, 12);
}

/** "Hoy", "Mañana" o "vie 3 oct". */
export function dayChipLabel(date: string, today: string): string {
  if (date === today) return 'Hoy';
  if (date === addDays(today, 1)) return 'Mañana';
  return new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })
    .format(dateOnly(date))
    .replace(/\./g, '')
    .replace(' de ', ' ');
}

/** "Hoy", "Mañana" o "viernes 3 de octubre". */
export function dayLongLabel(date: string, today: string): string {
  if (date === today) return 'Hoy';
  if (date === addDays(today, 1)) return 'Mañana';
  return new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })
    .format(dateOnly(date))
    .replace(',', '');
}

/** "1 h", "1 h 30", "45 min". */
export function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${hours} h`;
  if (hours === 0) return `${rest} min`;
  return `${hours} h ${rest}`;
}

/** "9:41" para la cuenta atrás del apartado. */
export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export const RESERVATION_STATE_LABEL: Record<ReservationStatus, string> = {
  pendiente_pago: 'Esperando pago',
  confirmada: 'Pagada',
  en_curso: 'En juego',
  terminada: 'Terminada',
  cancelada: 'Cancelada',
  expirada: 'Cancelada por tiempo de espera',
  conflicto: 'Revisar con el personal',
};

export const PAID_NOTICE: Record<ReservationPaymentMethod, string> = {
  saldo: '¡Listo! Tu cancha quedó pagada.',
  stripe: 'Completa el pago con tarjeta para confirmar tu cancha.',
  efectivo: 'Paga en caja antes de que venza el apartado.',
};
