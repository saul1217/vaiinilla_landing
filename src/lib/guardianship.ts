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

/** La sesión del hijo ya se cerró (logout o salir de su ficha): no se pide ni se entrega otro token. */
export class DependentContextClosedError extends Error {
  constructor() {
    super('La sesión del hijo ya se cerró.');
    this.name = 'DependentContextClosedError';
  }
}

/**
 * El token del hijo: se pide al abrir su ficha y se renueva un minuto antes de que venza. Vive solo
 * en memoria y nunca reemplaza la sesión del tutor (como `DependentContextSession` de Android).
 * Después de `clear()` la sesión queda inerte: no vuelve a pedir token, ni siquiera por un 401.
 */
export class DependentContextSession {
  private token: string | null = null;
  private expiresAt = 0;
  private inflight: Promise<string> | null = null;
  private closed = false;

  constructor(
    private readonly issue: () => Promise<DependentContextGrant>,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Olvida el token del hijo (al cerrar sesión o salir de su ficha) y deja la sesión inerte. Una emisión
   * en curso se descarta: quien la esperaba recibe DependentContextClosedError en vez del token.
   */
  clear(): void {
    this.closed = true;
    this.token = null;
    this.expiresAt = 0;
    this.inflight = null;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  async validToken(): Promise<string> {
    if (this.closed) throw new DependentContextClosedError();
    if (this.token && this.expiresAt - this.now() > RENEW_BEFORE_MS) return this.token;
    return this.refresh();
  }

  /** Dos llamadas a la vez esperan la misma emisión. */
  refresh(): Promise<string> {
    if (this.closed) return Promise.reject(new DependentContextClosedError());
    if (!this.inflight) {
      const pending = this.issue()
        .then((grant) => {
          // Si se limpió mientras se emitía, el token no se guarda ni se entrega.
          if (this.closed) throw new DependentContextClosedError();
          this.token = grant.access_token;
          this.expiresAt = this.now() + (grant.expires_in ?? DEFAULT_CONTEXT_SECONDS) * 1000;
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
   * nunca se reintenta con el del tutor. Si la sesión se cerró mientras tanto, el 401 llega tal cual
   * y no se pide otro token.
   */
  async run<T>(call: (token: string) => Promise<T>): Promise<T> {
    const token = await this.validToken();
    try {
      return await call(token);
    } catch (error) {
      if ((error as { status?: number })?.status === 401 && !this.closed) {
        return call(await this.refresh());
      }
      throw error;
    }
  }
}
