// Asistente de pedidos del cliente: `POST /asistente-cliente` (vaiinilla_back
// src/routes/asistente-cliente.routes.js). Mismo contrato y mismas reglas que Android
// (data/assistant/CustomerAssistantJson.kt y ui/assistant/CustomerAssistantViewModel.kt):
// la app manda la plática completa y recibe la siguiente respuesta. El asistente no
// crea nada: el pedido se pone en el carrito y se manda desde ahí, con el pago de siempre.
import { request } from './api';
import { errorMessage, VaiinillaApiError } from './api-error';
import type { CallReason } from './mesero-api';

/** Lo que acepta el servidor. */
export const MAX_MESSAGES = 40;
export const MAX_LETTERS = 600;
export const MAX_QUANTITY = 20;
export const MAX_COURTS = 4;
export const MAX_NAME = 60;

export const STARTERS = [
  '¿Qué me recomiendas?',
  'Algo para compartir',
  'Sin alcohol',
  '¿Qué no tiene gluten?',
  'Lo más rápido',
];

export interface AssistantProductCard {
  productId: number;
  name: string;
  /** Llega como "95.00". */
  price: string;
  imageUrl: string | null;
  available: boolean;
  needsOptions: boolean;
  minutes: number | null;
}

export interface AssistantOrderLine {
  product: AssistantProductCard;
  quantity: number;
  note: string | null;
}

/** Siempre completo: cada propuesta reemplaza a la anterior. */
export interface AssistantOrderProposal {
  lines: AssistantOrderLine[];
  total: string;
  unavailable: string[];
  toChoose: string[];
}

export interface AssistantWaiterOffer {
  reason: CallReason;
  detail: string | null;
}

/** Pista o cancha con la disponibilidad real que arma el servidor; horas locales "HH:MM". */
export interface AssistantCourtCard {
  courtId: number;
  name: string;
  freeNow: boolean;
  freeUntil: string | null;
  busyUntil: string | null;
  /** Efectivo o saldo; null si no se renta desde la app. */
  pricePerHour: string | null;
  cardPricePerHour: string | null;
  capacity: number | null;
}

export interface AssistantTurn {
  fromCustomer: boolean;
  text: string;
  products?: AssistantProductCard[];
  order?: AssistantOrderProposal | null;
  waiter?: AssistantWaiterOffer | null;
  courts?: AssistantCourtCard[];
}

export interface AssistantReply {
  message: string;
  products: AssistantProductCard[];
  order: AssistantOrderProposal | null;
  waiter: AssistantWaiterOffer | null;
  options: string[];
  remainingMessages: number;
  courts: AssistantCourtCard[];
}

const CALL_REASON_VALUES: CallReason[] = ['atencion', 'utensilios', 'problema', 'cuenta'];

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function str(obj: Json, key: string): string | null {
  const value = obj[key];
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function int(obj: Json, key: string): number | null {
  const value = obj[key];
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isInteger(n) ? n : null;
}

function bool(obj: Json, key: string): boolean | null {
  const value = obj[key];
  return typeof value === 'boolean' ? value : null;
}

const nonBlank = (value: string | null): string | null => (value && value.trim() !== '' ? value : null);

/** El cuerpo de ida: los últimos 40 mensajes, cada uno de hasta 600 letras. */
export function encodeTurns(turns: AssistantTurn[], establishmentId?: string | number | null) {
  const id = establishmentId == null ? '' : String(establishmentId).trim();
  const numericId = Number(id);
  return {
    ...(id !== '' ? { establecimiento_id: Number.isInteger(numericId) ? numericId : id } : {}),
    mensajes: turns.slice(-MAX_MESSAGES).map((turn) => ({
      rol: turn.fromCustomer ? 'cliente' : 'asistente',
      texto: turn.text.slice(0, MAX_LETTERS),
    })),
  };
}

function card(obj: Json): AssistantProductCard | null {
  const id = int(obj, 'producto_id');
  if (id == null) return null;
  return {
    productId: id,
    name: str(obj, 'nombre') ?? '',
    price: str(obj, 'precio') ?? '0',
    imageUrl: nonBlank(str(obj, 'imagen_url')),
    available: bool(obj, 'disponible') ?? true,
    needsOptions: bool(obj, 'requiere_opciones') ?? false,
    minutes: int(obj, 'minutos'),
  };
}

function order(obj: Json): AssistantOrderProposal | null {
  const lines = asArray(obj.lineas).flatMap((element): AssistantOrderLine[] => {
    if (!isObject(element)) return [];
    const product = card(element);
    if (!product) return [];
    const quantity = Math.min(MAX_QUANTITY, Math.max(1, int(element, 'cantidad') ?? 1));
    return [{ product, quantity, note: nonBlank(str(element, 'nota')?.trim() ?? null) }];
  });
  const unavailable = asArray(obj.no_disponibles).filter((item): item is string => typeof item === 'string');
  const toChoose = asArray(obj.por_elegir).flatMap((item) => {
    const name = isObject(item) ? str(item, 'nombre') : null;
    return name ? [name] : [];
  });
  if (lines.length === 0 && unavailable.length === 0 && toChoose.length === 0) return null;
  return { lines, total: str(obj, 'total') ?? '0', unavailable, toChoose };
}

function waiter(obj: Json): AssistantWaiterOffer | null {
  const reason = CALL_REASON_VALUES.find((value) => value === str(obj, 'motivo'));
  if (!reason) return null;
  return { reason, detail: nonBlank(str(obj, 'detalle')?.trim() ?? null) };
}

function court(obj: Json): AssistantCourtCard | null {
  const id = int(obj, 'espacio_id');
  if (id == null) return null;
  const price = obj.precio_hora;
  const cash = isObject(price) ? str(price, 'efectivo_saldo') : typeof price === 'string' ? price : null;
  const cardPrice = nonBlank(isObject(price) ? str(price, 'tarjeta') : null);
  const capacity = int(obj, 'capacidad');
  return {
    courtId: id,
    name: nonBlank(str(obj, 'nombre')?.trim() ?? null) ?? 'Pista',
    freeNow: bool(obj, 'libre_ahora') ?? false,
    freeUntil: nonBlank(str(obj, 'libre_hasta')),
    busyUntil: nonBlank(str(obj, 'ocupada_hasta')),
    pricePerHour: nonBlank(cash) ?? cardPrice,
    cardPricePerHour: cardPrice,
    capacity: capacity != null && capacity > 0 ? capacity : null,
  };
}

/** Acepta `{ data: {...} }` o el objeto suelto, como Android. */
export function parseReply(body: unknown): AssistantReply {
  const root = isObject(body) ? body : {};
  const data = isObject(root.data) ? root.data : root;
  const seen = new Set<number>();
  const courts = asArray(data.pistas)
    .flatMap((item) => {
      const parsed = isObject(item) ? court(item) : null;
      if (!parsed || seen.has(parsed.courtId)) return [];
      seen.add(parsed.courtId);
      return [parsed];
    })
    .slice(0, MAX_COURTS);
  return {
    message: (str(data, 'mensaje') ?? '').trim(),
    products: asArray(data.productos).flatMap((item) => {
      const parsed = isObject(item) ? card(item) : null;
      return parsed ? [parsed] : [];
    }),
    order: isObject(data.pedido) ? order(data.pedido) : null,
    waiter: isObject(data.llamar_mesero) ? waiter(data.llamar_mesero) : null,
    options: asArray(data.opciones).flatMap((item) =>
      typeof item === 'string' && item.trim() !== '' ? [item.trim()] : [],
    ),
    remainingMessages: int(data, 'quedan_mensajes') ?? MAX_MESSAGES,
    courts,
  };
}

export async function askAssistant(
  token: string,
  turns: AssistantTurn[],
  establishmentId?: string | number | null,
): Promise<AssistantReply> {
  const envelope = await request<unknown>('/asistente-cliente', {
    method: 'POST',
    token,
    body: encodeTurns(turns, establishmentId),
  });
  return parseReply(envelope);
}

/** La tienda apagó el asistente para clientes: ya no se platica ni se reintenta. */
export function isAssistantDisabled(error: unknown): boolean {
  return error instanceof VaiinillaApiError && error.code === 'ASSISTANT_DISABLED';
}

const SERVER_WORDED = new Set([
  'ASSISTANT_UNAVAILABLE',
  'ASSISTANT_DISABLED',
  'CONTEXT_MISMATCH',
  'RATE_LIMITED',
  'VALIDATION_ERROR',
]);

/** Lo que el servidor explica para el asistente se dice tal cual; lo demás, un aviso genérico. */
export function assistantErrorMessage(error: unknown): string {
  if (error instanceof VaiinillaApiError) {
    if (SERVER_WORDED.has(error.code) && error.message.trim() !== '') return error.message.trim();
    if (error.status === 0 || error.status === 401) return errorMessage(error);
  }
  return 'No pude contestar. Intenta de nuevo.';
}

export function courtAvailability(court: AssistantCourtCard): string {
  if (court.freeNow && court.freeUntil) return `Libre hasta las ${court.freeUntil}`;
  if (court.freeNow) return 'Libre ahora';
  if (court.busyUntil) return `Ocupada hasta las ${court.busyUntil}`;
  return 'Ocupada ahora';
}

export function cleanGuestName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME);
}

// ---------------- estado de la plática ----------------

export interface AssistantState {
  /** Cambia con cada plática nueva: una respuesta en camino de la anterior ya no entra. */
  conversation: number;
  turns: AssistantTurn[];
  thinking: boolean;
  error: string | null;
  options: string[];
  remaining: number;
  /** Turnos cuyo pedido ya se puso en el carrito o cuyo mesero ya se llamó. */
  done: number[];
  /** Lo que el último pedido del asistente puso en el carrito: el siguiente lo reemplaza. */
  cartOrder: AssistantOrderLine[];
  /** Compra sin cuenta: antes de la primera respuesta se pide su nombre (lo usa el mesero). */
  needsName: boolean;
  /** ASSISTANT_DISABLED: la tienda lo apagó. */
  closed: boolean;
}

export const initialAssistantState = (conversation = 0): AssistantState => ({
  conversation,
  turns: [],
  thinking: false,
  error: null,
  options: [],
  remaining: MAX_MESSAGES,
  done: [],
  cartOrder: [],
  needsName: false,
  closed: false,
});

export const canSend = (state: AssistantState): boolean =>
  !state.thinking && !state.needsName && !state.closed && state.remaining > 1;

/** Solo el pedido más reciente se puede poner en el carrito: los de antes ya los reemplazó. */
export function latestOrderTurn(state: AssistantState): number {
  for (let i = state.turns.length - 1; i >= 0; i -= 1) if (state.turns[i]?.order) return i;
  return -1;
}

export type AssistantAction =
  | { type: 'send'; text: string }
  | { type: 'thinking'; conversation: number }
  | { type: 'needsName'; conversation: number }
  | { type: 'nameAccepted' }
  | { type: 'reply'; conversation: number; reply: AssistantReply }
  | { type: 'failed'; conversation: number; message: string; closed: boolean }
  | { type: 'restart' }
  | { type: 'done'; turn: number }
  | { type: 'orderInCart'; turn: number; added: AssistantOrderLine[] }
  | { type: 'forgetCartOrder' };

export function assistantReducer(state: AssistantState, action: AssistantAction): AssistantState {
  const stale = 'conversation' in action && action.conversation !== state.conversation;
  if (stale) return state;
  switch (action.type) {
    case 'send': {
      const text = action.text.trim().slice(0, MAX_LETTERS);
      if (!text || !canSend(state)) return state;
      return {
        ...state,
        turns: [...state.turns, { fromCustomer: true, text }],
        error: null,
        options: [],
      };
    }
    case 'thinking':
      return { ...state, thinking: true, error: null };
    case 'needsName':
      return { ...state, thinking: false, needsName: true };
    case 'nameAccepted':
      return { ...state, needsName: false };
    case 'reply':
      return {
        ...state,
        turns: [
          ...state.turns,
          {
            fromCustomer: false,
            text: action.reply.message || '¿Qué se te antoja?',
            products: action.reply.products,
            order: action.reply.order,
            waiter: action.reply.waiter,
            courts: action.reply.courts,
          },
        ],
        thinking: false,
        options: action.reply.options,
        remaining: action.reply.remainingMessages,
      };
    case 'failed':
      return { ...state, thinking: false, error: action.message, closed: state.closed || action.closed };
    case 'restart':
      return initialAssistantState(state.conversation + 1);
    case 'done':
      return state.done.includes(action.turn) ? state : { ...state, done: [...state.done, action.turn] };
    case 'orderInCart':
      return {
        ...state,
        done: state.done.includes(action.turn) ? state.done : [...state.done, action.turn],
        cartOrder: action.added,
      };
    case 'forgetCartOrder':
      return state.cartOrder.length === 0 ? state : { ...state, cartOrder: [] };
    default:
      return state;
  }
}
