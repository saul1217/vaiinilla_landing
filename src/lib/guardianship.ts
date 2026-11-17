// Modo papás (docs/padres-hijos.md del backend): el tutor ve a sus hijos con `GET /tutelas` y,
// para ver el saldo, los movimientos y los pedidos de uno, pide su contexto con
// `POST /tutelas/:id/contexto` y llama `GET /wallets/me` y `GET /pedidos` con ese token.
// Es la misma lectura que hace Android (GuardianshipJson y ChildAccountState).

import type { OrderDetail, WalletMovement } from '../types/api';
import { formatAmount } from './money';

export type GuardianshipState = 'aprobada' | 'pendiente' | 'desconocido';

export interface DependentControls {
  dailyLimit: string | null;
  lowBalanceAlert: string | null;
  notes: string;
  blockedProductIds: number[];
  blockedCategoryIds: number[];
  allergens: string[];
  /** Lo que gastó hoy; nulo sin límite diario. */
  spentToday: string | null;
  /** Lo que le queda hoy del límite (nunca negativo); nulo sin límite diario. */
  availableToday: string | null;
}

export interface ChildGuardian {
  id: string;
  name: string;
  isPrincipal: boolean;
  isYou: boolean;
}

export interface Dependent {
  userId: string;
  name: string;
  group: string | null;
  photoUrl: string | null;
  studentId: string | null;
  hasOwnAccount: boolean;
  state: GuardianshipState;
  /** Solo con la tutela aprobada. Pendiente no es cero: no se ve. */
  balance: string | null;
  controls: DependentControls | null;
  isPrincipal: boolean;
  guardians: ChildGuardian[];
  hasPin: boolean;
  hasCredential: boolean;
  needsConsent: boolean;
}

export interface PrivacyNotice {
  version: string;
  draft: boolean;
  title: string;
  paragraphs: string[];
}

export interface DependentContextGrant {
  access_token: string;
  expires_in?: number;
}

type Raw = Record<string, unknown>;

const isObject = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value : null);
const money = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(2);
  return text(value);
};
const ints = (value: unknown): number[] =>
  Array.isArray(value) ? value.map(Number).filter((item) => Number.isInteger(item)) : [];
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

function stateFrom(value: unknown): GuardianshipState {
  // Solo un `estado: 'aprobada'` explícito abre al hijo; sin estado (o con uno que no conocemos)
  // no se da por aprobada, para no enseñar datos de una tutela que el servidor no confirmó.
  if (value === 'aprobada') return 'aprobada';
  if (value === 'pendiente') return 'pendiente';
  return 'desconocido';
}

function controlsFrom(raw: Raw): DependentControls {
  return {
    dailyLimit: money(raw.limite_diario),
    lowBalanceAlert: money(raw.umbral_saldo_bajo),
    notes: text(raw.notas) ?? '',
    blockedProductIds: ints(raw.productos_bloqueados),
    blockedCategoryIds: ints(raw.categorias_bloqueadas),
    allergens: strings(raw.alergenos),
    spentToday: money(raw.gastado_hoy),
    availableToday: money(raw.disponible_hoy),
  };
}

/** Un hijo de `GET /tutelas`. Devuelve null si le falta el id (no se puede abrir). */
export function parseDependent(raw: unknown): Dependent | null {
  if (!isObject(raw)) return null;
  const userId = text(raw.usuario_id);
  if (!userId) return null;
  const state = stateFrom(raw.estado);
  const needsConsent = raw.requiere_consentimiento === true;
  // Sin el aviso de privacidad vigente aceptado no se guarda nada del hijo, aunque el servidor lo mande.
  const visible = state === 'aprobada' && !needsConsent;
  const credentials = isObject(raw.credenciales) ? raw.credenciales : null;
  return {
    userId,
    name: text(raw.nombre) ?? 'Sin nombre',
    group: text(raw.grupo),
    photoUrl: text(raw.foto_url),
    studentId: text(raw.matricula),
    hasOwnAccount: raw.tiene_cuenta === true,
    state,
    balance: visible ? money(raw.saldo) : null,
    controls: visible && isObject(raw.controles) ? controlsFrom(raw.controles) : null,
    // Sin la migración 101 cada tutor seguía siendo dueño de los controles.
    isPrincipal: typeof raw.soy_principal === 'boolean' ? raw.soy_principal : true,
    guardians: Array.isArray(raw.tutores)
      ? raw.tutores.filter(isObject).flatMap((item) => {
          const id = text(item.tutela_id);
          return id
            ? [{ id, name: text(item.nombre) ?? '', isPrincipal: item.principal === true, isYou: item.eres_tu === true }]
            : [];
        })
      : [],
    hasPin: raw.tiene_pin === true,
    hasCredential: credentials?.qr === true || credentials?.nfc === true,
    needsConsent,
  };
}

/** Solo un hijo aprobado y con el aviso vigente aceptado muestra sus datos y pide su contexto. */
export function canViewDependent(child: Pick<Dependent, 'state' | 'needsConsent'>): boolean {
  return child.state === 'aprobada' && !child.needsConsent;
}

/** El servidor pide el aviso de privacidad vigente antes de seguir (por ejemplo, al pedir el contexto). */
export function isConsentRequired(error: unknown): boolean {
  const failure = error as { status?: number; code?: string } | null;
  if (failure?.code === 'CONSENT_REQUIRED') return true;
  // `POST /tutelas/:id/contexto` responde 422 mientras el hijo requiera el consentimiento.
  return failure?.status === 422 && typeof failure.code === 'string' && failure.code.includes('CONSENT');
}

export function parseDependents(raw: unknown): Dependent[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(parseDependent).filter((item): item is Dependent => item !== null);
}

export function parsePrivacyNotice(raw: unknown): PrivacyNotice | null {
  if (!isObject(raw)) return null;
  const version = text(raw.version);
  if (!version) return null;
  return {
    version,
    draft: raw.borrador === true,
    title: text(raw.titulo) ?? 'Aviso de privacidad',
    paragraphs: strings(raw.parrafos),
  };
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

const ALLERGEN_LABELS: Record<string, string> = {
  gluten: 'Gluten',
  crustaceos: 'Crustáceos',
  huevo: 'Huevo',
  pescado: 'Pescado',
  cacahuate: 'Cacahuate',
  soya: 'Soya',
  lacteos: 'Lácteos',
  nueces: 'Nueces',
  apio: 'Apio',
  mostaza: 'Mostaza',
  ajonjoli: 'Ajonjolí',
  sulfitos: 'Sulfitos',
  altramuces: 'Altramuces',
  moluscos: 'Moluscos',
  lactosa: 'Lactosa',
  colorantes: 'Colorantes',
};

/** "Alergias" de la ficha: los nombres del catálogo (los códigos desconocidos se omiten, como en Android). */
export function allergensLine(controls: DependentControls | null): string {
  const labels = (controls?.allergens ?? [])
    .map((code) => ALLERGEN_LABELS[code])
    .filter((label): label is string => Boolean(label))
    .sort((a, b) => a.localeCompare(b, 'es'));
  return labels.length > 0 ? `${labels.join(', ')} · no se le vende` : 'Ninguna anotada';
}

/** "No puede comprar": cuántas categorías y productos le bloquearon. */
export function blockedLine(controls: DependentControls | null): string {
  const categories = controls?.blockedCategoryIds.length ?? 0;
  const products = controls?.blockedProductIds.length ?? 0;
  const parts: string[] = [];
  if (categories > 0) parts.push(categories === 1 ? '1 categoría' : `${categories} categorías`);
  if (products > 0) parts.push(products === 1 ? '1 producto' : `${products} productos`);
  return parts.length > 0 ? parts.join(' y ') : 'Nada bloqueado';
}

/** "Hoy le quedan": lo que le queda del límite, "Sin límite", o null si el servidor no lo manda. */
export function dailyRemainingLabel(controls: DependentControls | null): string | null {
  if (!controls) return null;
  if (controls.availableToday !== null) return formatAmount(controls.availableToday);
  if (controls.dailyLimit === null) return 'Sin límite';
  return null;
}

/** Nombre del movimiento de la cartera, igual que `movementLabel` de Android. */
export function movementLabel(movement: Pick<WalletMovement, 'tipo' | 'descripcion'>): string {
  switch (movement.tipo) {
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
      return movement.descripcion?.trim() || 'Ajuste autorizado';
    default:
      return movement.descripcion?.trim() || 'Movimiento';
  }
}

/** "−$45" o "+$100": el signo del monto que manda el servidor. */
export function signedAmount(amount: string): string {
  const value = amount.trim();
  if (value.startsWith('-')) return `−${formatAmount(value.slice(1))}`;
  return `+${formatAmount(value.replace(/^\+/, ''))}`;
}

/** Fecha corta en español de un `creado_en` ISO; vacío si no se entiende. */
export function shortDate(iso: string | null | undefined, timeZone?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(date);
}

/** "2× Torta, 1× Agua" como el resumen de lo apartado en Android. */
export function orderSummary(order: Pick<OrderDetail, 'items'>): string {
  return (order.items ?? []).map((item) => `${item.cantidad ?? 1}× ${item.nombre_producto ?? ''}`.trim()).join(', ');
}

/** Códigos con los que el servidor dice que este tutor ya no puede actuar por el hijo. */
export const ACCESS_LOST_CODES = new Set(['CONTEXT_NOT_ALLOWED', 'GUARDIANSHIP_NOT_FOUND']);

const RENEW_BEFORE_MS = 60_000;
const DEFAULT_CONTEXT_SECONDS = 900;

/**
 * El token del hijo: se pide al abrir su ficha y se renueva un minuto antes de que venza. Vive solo
 * en memoria y nunca reemplaza la sesión del tutor (como `DependentContextSession` de Android).
 */
export class DependentContextSession {
  private token: string | null = null;
  private expiresAt = 0;
  private inflight: Promise<string> | null = null;
  private generation = 0;

  constructor(
    private readonly issue: () => Promise<DependentContextGrant>,
    private readonly now: () => number = Date.now,
  ) {}

  /** Olvida el token del hijo (al cerrar sesión o salir de su ficha). Una emisión en curso se descarta. */
  clear(): void {
    this.token = null;
    this.expiresAt = 0;
    this.inflight = null;
    this.generation += 1;
  }

  async validToken(): Promise<string> {
    if (this.token && this.expiresAt - this.now() > RENEW_BEFORE_MS) return this.token;
    return this.refresh();
  }

  /** Dos llamadas a la vez esperan la misma emisión. */
  refresh(): Promise<string> {
    if (!this.inflight) {
      const generation = this.generation;
      const pending = this.issue()
        .then((grant) => {
          // Si se limpió mientras se emitía, el token no se guarda.
          if (generation === this.generation) {
            this.token = grant.access_token;
            this.expiresAt = this.now() + (grant.expires_in ?? DEFAULT_CONTEXT_SECONDS) * 1000;
          }
          return grant.access_token;
        })
        .finally(() => {
          if (this.inflight === pending) this.inflight = null;
        });
      this.inflight = pending;
    }
    return this.inflight;
  }

  /**
   * Hace la llamada con el token del hijo. Un 401 renueva solo el token del hijo y repite una vez;
   * nunca se reintenta con el del tutor.
   */
  async run<T>(call: (token: string) => Promise<T>): Promise<T> {
    const token = await this.validToken();
    try {
      return await call(token);
    } catch (error) {
      if ((error as { status?: number })?.status === 401) {
        return call(await this.refresh());
      }
      throw error;
    }
  }
}

// ---- Lo que el tutor cambia (Expo `createGuardianshipRepository`, Doop E05 a E14) ----

/** Código para vincular a un hijo o invitar a otro tutor (6 caracteres). */
export const LINK_CODE_LENGTH = 6;
/** Código para que el hijo active su propia cuenta (8 caracteres). */
export const CLAIM_CODE_LENGTH = 8;
export const CONTROLS_NOTES_LIMIT = 200;

/** Los alérgenos que la escuela conoce, en el orden en que se muestran. */
export const SCHOOL_ALLERGENS = Object.keys(ALLERGEN_LABELS).sort((a, b) =>
  ALLERGEN_LABELS[a]!.localeCompare(ALLERGEN_LABELS[b]!, 'es'),
);

export function allergenLabel(code: string): string {
  return ALLERGEN_LABELS[code] ?? code;
}

export function normalizeCodeInput(raw: string, maxLength: number): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, maxLength);
}

export function addChildFormProblem(params: {
  withCode: boolean;
  name: string;
  studentId: string;
  code: string;
  consentAccepted: boolean;
  noticeReady: boolean;
}): string | null {
  if (!params.noticeReady) return 'Espera el aviso de privacidad para continuar.';
  if (!params.consentAccepted) return 'Marca que eres su madre, padre o tutor.';
  if (params.withCode) {
    return normalizeCodeInput(params.code, LINK_CODE_LENGTH).length === LINK_CODE_LENGTH
      ? null
      : `Escribe el código de ${LINK_CODE_LENGTH} letras o números.`;
  }
  if (!params.name.trim()) return 'Escribe el nombre completo de tu hijo.';
  if (!params.studentId.trim()) return 'Escribe la matrícula de su credencial.';
  return null;
}

/** Vacío es válido (quita el límite o el aviso). */
export function controlAmountProblem(text: string): string | null {
  const clean = text.trim().replace(/^\$/, '').replace(/,/g, '');
  if (!clean) return null;
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(clean)) return 'Escribe una cantidad válida, por ejemplo 120.';
  return Number(clean) > 0 ? null : 'Tiene que ser mayor a cero.';
}

export function parseControlMoneyOrNull(text: string): string | null {
  const clean = text.trim().replace(/^\$/, '').replace(/,/g, '');
  if (!clean) return null;
  const value = Number(clean);
  return Number.isFinite(value) && value > 0 ? value.toFixed(2) : null;
}

export function emptyControls(): DependentControls {
  return {
    dailyLimit: null,
    lowBalanceAlert: null,
    notes: '',
    blockedProductIds: [],
    blockedCategoryIds: [],
    allergens: [],
    spentToday: null,
    availableToday: null,
  };
}

/** Cuerpo de `PATCH /tutelas/:id`: los nulos viajan (quitan el límite) y las listas se reemplazan completas. */
export function encodeControls(controls: DependentControls): Record<string, unknown> {
  return {
    limite_diario: controls.dailyLimit,
    umbral_saldo_bajo: controls.lowBalanceAlert,
    notas: controls.notes.trim() || null,
    productos_bloqueados: [...controls.blockedProductIds].sort((a, b) => a - b),
    categorias_bloqueadas: [...controls.blockedCategoryIds].sort((a, b) => a - b),
    alergenos: [...controls.allergens].sort(),
  };
}

export interface LinkCode {
  code: string;
  expiresAt: string | null;
}

export function parseLinkCode(raw: unknown): LinkCode {
  const code = isObject(raw) ? text(raw.codigo) : null;
  if (!code) throw new Error('El servidor no mandó el código.');
  return { code, expiresAt: isObject(raw) ? text(raw.vence_en) : null };
}

export type StudentRequestKind = 'devolucion' | 'baja_datos';
export type RefundMethod = 'efectivo' | 'transferencia';
export type StudentRequestStatus = 'pendiente' | 'resuelta' | 'rechazada';

export const REFUND_METHOD_LABEL: Record<RefundMethod, string> = {
  efectivo: 'En efectivo',
  transferencia: 'Por transferencia',
};

export interface StudentRequest {
  id: string;
  kind: StudentRequestKind;
  status: StudentRequestStatus;
  refundMethod: RefundMethod | null;
  note: string | null;
  balanceAtRequest: string;
  refunded: string | null;
  rejectionReason: string | null;
  createdAt: string | null;
}

const REQUEST_KINDS: readonly StudentRequestKind[] = ['devolucion', 'baja_datos'];
const REQUEST_STATUSES: readonly StudentRequestStatus[] = ['pendiente', 'resuelta', 'rechazada'];
const REFUND_METHODS: readonly RefundMethod[] = ['efectivo', 'transferencia'];

/** Un tipo o estado que esta versión no conoce se omite, como en Expo. */
export function parseStudentRequest(raw: unknown): StudentRequest | null {
  if (!isObject(raw)) return null;
  const id = text(raw.id);
  const kind = REQUEST_KINDS.find((item) => item === raw.tipo);
  const status = REQUEST_STATUSES.find((item) => item === raw.estado);
  if (!id || !kind || !status) return null;
  return {
    id,
    kind,
    status,
    refundMethod: REFUND_METHODS.find((item) => item === raw.como_devolver) ?? null,
    note: text(raw.nota),
    balanceAtRequest: money(raw.saldo_al_pedir) ?? '0.00',
    refunded: money(raw.monto_devuelto),
    rejectionReason: text(raw.motivo_rechazo),
    createdAt: text(raw.creado_en),
  };
}

export function parseStudentRequests(raw: unknown): StudentRequest[] {
  return Array.isArray(raw) ? raw.map(parseStudentRequest).filter((item): item is StudentRequest => item !== null) : [];
}

export function studentRequestLine(request: StudentRequest): string {
  const what = request.kind === 'devolucion' ? 'Devolución de saldo' : 'Baja de cuenta y datos';
  const status =
    request.status === 'pendiente'
      ? 'En revisión'
      : request.status === 'resuelta'
        ? request.refunded
          ? `Resuelta · se devolvieron ${formatAmount(request.refunded)}`
          : 'Resuelta'
        : `Rechazada${request.rejectionReason ? ` · ${request.rejectionReason}` : ''}`;
  return `${what} · ${status}`;
}

/** Lo que ve el alumno de sí mismo (`GET /tutelas/mis-controles`). */
export interface MyGuardianControls {
  tutorNames: string[];
  dailyLimit: string | null;
  availableToday: string | null;
  blockedProductIds: number[];
  blockedCategoryIds: number[];
  allergens: string[];
  /** Lo que el servidor no le vende por sus alergias. */
  allergenProductIds: number[];
  /** Lo que no tiene alérgenos revisados y por eso tampoco se le vende. */
  unreviewedProductIds: number[];
}

export function parseMyControls(raw: unknown): MyGuardianControls | null {
  if (!isObject(raw) || !isObject(raw.controles)) return null;
  const controls = raw.controles;
  return {
    tutorNames: Array.isArray(raw.tutores)
      ? raw.tutores.flatMap((item) => {
          const name = isObject(item) ? text(item.nombre) : null;
          return name ? [name] : [];
        })
      : [],
    dailyLimit: money(controls.limite_diario),
    availableToday: money(controls.disponible_hoy),
    blockedProductIds: ints(controls.productos_bloqueados),
    blockedCategoryIds: ints(controls.categorias_bloqueadas),
    allergens: strings(controls.alergenos),
    allergenProductIds: ints(controls.productos_con_alergeno),
    unreviewedProductIds: ints(controls.productos_sin_revisar),
  };
}

/** Por qué no se le puede apartar un platillo (Expo `allergenBlocked`); nulo si sí. */
export function plannerBlockReason(productId: number, controls: MyGuardianControls | null): string | null {
  if (controls?.allergenProductIds.includes(productId)) return 'Tiene un alérgeno';
  if (controls?.unreviewedProductIds.includes(productId)) return 'Sin alérgenos revisados';
  return null;
}

// ---- Comida apartada de la semana (Expo `WeekPlannerRules`) ----

export interface MenuSchedule {
  today: string;
  daysAhead: number;
  orderCutoff: string | null;
  cancelCutoff: string | null;
  slots: string[];
}

export interface ChildMenuCalendar {
  schedule: MenuSchedule;
  days: { date: string; productIds: number[] }[];
  closedDays: { date: string; reason: string }[];
}

export function parseChildMenuCalendar(raw: unknown): ChildMenuCalendar {
  const data = isObject(raw) ? raw : {};
  const schedule = isObject(data.programacion) ? data.programacion : {};
  const day = (value: unknown) => (text(value) ?? '').slice(0, 10);
  return {
    schedule: {
      today: day(schedule.hoy),
      daysAhead: typeof schedule.dias_adelanto_pedido === 'number' ? schedule.dias_adelanto_pedido : 0,
      orderCutoff: text(schedule.hora_corte_pedido)?.slice(0, 5) ?? null,
      cancelCutoff: text(schedule.hora_corte_cancelacion)?.slice(0, 5) ?? null,
      slots: strings(schedule.franjas),
    },
    days: (Array.isArray(data.dias) ? data.dias : []).filter(isObject).map((item) => ({
      date: day(item.fecha),
      productIds: ints(item.producto_ids),
    })),
    closedDays: (Array.isArray(data.sin_servicio) ? data.sin_servicio : []).filter(isObject).map((item) => ({
      date: day(item.fecha),
      reason: text(item.motivo) ?? '',
    })),
  };
}

export interface ScheduledDayOrder {
  date: string;
  slot: string | null;
  items: { productId: number; quantity: number; optionIds: number[] }[];
}

/** Cuerpo de `POST /pedidos/semana`. */
export function encodeWeekOrders(days: ScheduledDayOrder[]): Record<string, unknown> {
  return {
    pedidos: days.map((item) => ({
      fecha_entrega: item.date,
      ...(item.slot !== null ? { franja_entrega: item.slot } : {}),
      items: item.items.map((line) => ({
        producto_id: line.productId,
        cantidad: line.quantity,
        opcion_ids: line.optionIds,
      })),
    })),
  };
}

/** "2026-11-16" más `days` días, sin pasar por la zona horaria del navegador. */
export function addDays(date: string, days: number): string {
  const [year, month, dayOfMonth] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year!, (month ?? 1) - 1, dayOfMonth ?? 1));
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** "18:05" en la zona del negocio (la escuela está en México). */
export function businessClock(now: Date = new Date(), timeZone = 'America/Mexico_City'): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(now);
}

/** Días que se pueden apartar: desde hoy (si no pasó la hora de corte) hasta los días de adelanto. */
export function plannerDates(calendar: ChildMenuCalendar, nowHhMm: string = businessClock()): string[] {
  const today = calendar.schedule.today;
  if (!today) return [];
  const maxOffset = Math.max(1, calendar.schedule.daysAhead || 5);
  const dates: string[] = [];
  for (let offset = 0; offset <= maxOffset; offset += 1) {
    const date = addDays(today, offset);
    if (offset === 0 && calendar.schedule.orderCutoff && nowHhMm >= calendar.schedule.orderCutoff) continue;
    dates.push(date);
  }
  return dates;
}

export function closedReason(calendar: ChildMenuCalendar, date: string): string | null {
  return calendar.closedDays.find((item) => item.date === date)?.reason ?? null;
}

/** Sin menú publicado ese día se ofrece todo lo disponible, como en Expo. */
export function plannerProductIds(calendar: ChildMenuCalendar, date: string): Set<number> | null {
  const day = calendar.days.find((item) => item.date === date);
  return day ? new Set(day.productIds) : null;
}

export function dayShortLabel(date: string, today: string): string {
  if (date === today) return 'Hoy';
  if (date === addDays(today, 1)) return 'Mañana';
  const [year, month, dayOfMonth] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year!, (month ?? 1) - 1, dayOfMonth ?? 1)),
  );
}

export function scheduledOrderPolicyText(cancelCutoff: string | null): string {
  if (cancelCutoff) return `Puedes cancelar cada día apartado antes de las ${cancelCutoff} h.`;
  return 'Los apartados se descuentan de su saldo al confirmar y regresan si cancelas a tiempo.';
}

/** Un apartado se cancela si es de hoy en adelante, no se entregó y no pasó la hora de corte de hoy. */
export function canCancelScheduled(
  order: Pick<OrderDetail, 'estado'> & { fecha_entrega?: string | null },
  today: string,
  cancelCutoff: string | null,
  nowHhMm: string = businessClock(),
): boolean {
  const delivery = order.fecha_entrega?.slice(0, 10);
  if (!delivery) return false;
  if (order.estado === 'cancelado' || order.estado === 'entregado') return false;
  if (delivery < today) return false;
  if (delivery === today && cancelCutoff && nowHhMm >= cancelCutoff) return false;
  return true;
}
