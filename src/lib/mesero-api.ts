// Waiter calls and the table board. Contract: docs/mesero-backend.md.
// Until the backend ships /llamadas and /espacios/tablero, the board falls back
// to GET /espacios + GET /pedidos?estado=listo, and calls report `callsEnabled: false`.
import { api } from './api';
import { VaiinillaApiError } from './api-error';
import { createIdempotencyKey } from './idempotency';
import type { ApiEnvelope, ApiErrorEnvelope, OrderDetail, SessionAccess } from '../types/api';

export type CallReason = 'atencion' | 'utensilios' | 'problema';
export type CallStatus = 'pendiente' | 'en_camino' | 'atendida' | 'cancelada' | 'expirada';

export const CALL_REASONS: { value: CallReason; label: string; staff: string }[] = [
  { value: 'atencion', label: 'Necesito algo', staff: 'Necesita atención' },
  { value: 'utensilios', label: 'Cubiertos o servilletas', staff: 'Pide cubiertos o servilletas' },
  { value: 'problema', label: 'Algo está mal con mi pedido', staff: 'Algo está mal con su pedido' },
];

export interface TableSpace {
  id: number;
  nombre: string;
  tipo: string;
}

export interface TableCall {
  id: string;
  espacio: TableSpace;
  pedido_id: string | null;
  motivo: CallReason;
  estado: CallStatus;
  cliente: { nombre: string } | null;
  tomada_por: { usuario_id: string; nombre: string } | null;
  creado_en: string;
  tomada_en: string | null;
  cerrada_en: string | null;
  version: number;
}

export interface BoardOrder {
  id: string;
  folio: number;
  estado: OrderDetail['estado'];
  version: number;
  cliente: { nombre: string } | null;
  items_resumen: string;
  actualizado_en: string;
}

export interface BoardTable {
  espacio: TableSpace;
  llamada: TableCall | null;
  pedidos: BoardOrder[];
}

export interface Board {
  tables: BoardTable[];
  /** False while the backend has no /llamadas yet. */
  callsEnabled: boolean;
}

export const OPEN_CALL: CallStatus[] = ['pendiente', 'en_camino'];

async function request<T>(path: string, init: { token: string; method?: string; body?: unknown; idempotent?: boolean }): Promise<T> {
  const headers = new Headers({ Accept: 'application/json', Authorization: `Bearer ${init.token}` });
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');
  if (init.idempotent) headers.set('Idempotency-Key', createIdempotencyKey());
  let response: Response;
  try {
    response = await fetch(`${api.apiUrl}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new VaiinillaApiError(0, { code: 'BACKEND_UNAVAILABLE', message: 'Sin conexión con el servidor. Reintentando…' });
  }
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | ApiErrorEnvelope | null;
  if (!response.ok || !payload || payload.error) {
    const error = payload?.error ?? { code: 'HTTP_ERROR', message: 'El servidor no devolvió una respuesta válida.' };
    throw new VaiinillaApiError(response.status, error, Number(response.headers.get('Retry-After')) || undefined);
  }
  return payload.data;
}

const missing = (error: unknown) => error instanceof VaiinillaApiError && (error.status === 404 || error.status === 405 || error.status === 501);

function summarize(order: OrderDetail) {
  return order.items.map((item) => `${item.cantidad}× ${item.nombre_producto}`).join(', ');
}

// ---------------- staff context ----------------

export function waiterAccesses(accesses: SessionAccess[]) {
  return accesses.filter((access) => access.rol === 'mesero' && access.estado_establecimiento === 'activo');
}

export interface StaffContext {
  access_token: string;
  expires_in: number;
  contexto: { usuario_id: string; establecimiento_id: string; rol: string };
}

export async function createStaffContext(firebaseToken: string, membresiaId: string): Promise<StaffContext> {
  return request<StaffContext>('/sesiones/contexto', { token: firebaseToken, method: 'POST', body: { membresia_id: membresiaId } });
}

// ---------------- waiter ----------------

export interface WaiterClient {
  board(): Promise<Board>;
  transitionCall(call: TableCall, target: 'en_camino' | 'atendida'): Promise<TableCall>;
  deliver(order: BoardOrder, qrToken: string): Promise<void>;
}

export function createWaiterClient(getToken: () => Promise<string>): WaiterClient {
  let callsEnabled = true;
  let boardEndpoint = true;

  async function fallbackBoard(token: string): Promise<BoardTable[]> {
    const [spaces, ready] = await Promise.all([
      request<TableSpace[]>('/espacios', { token }),
      request<OrderDetail[]>('/pedidos?estado=listo', { token }),
    ]);
    return spaces.map((espacio) => ({
      espacio,
      llamada: null,
      pedidos: ready
        .filter((order) => order.destino === 'en_espacio' && order.espacio?.id === espacio.id)
        .map((order) => ({
          id: order.id,
          folio: order.folio,
          estado: order.estado,
          version: order.version,
          cliente: order.usuario ? { nombre: order.usuario.nombre } : null,
          items_resumen: summarize(order),
          actualizado_en: order.actualizado_en,
        })),
    }));
  }

  return {
    async board() {
      const token = await getToken();
      let tables: BoardTable[];
      if (boardEndpoint) {
        try {
          tables = await request<BoardTable[]>('/espacios/tablero', { token });
        } catch (error) {
          if (!missing(error)) throw error;
          boardEndpoint = false;
          tables = await fallbackBoard(token);
        }
      } else {
        tables = await fallbackBoard(token);
      }
      if (!boardEndpoint && callsEnabled) {
        try {
          const calls = await request<TableCall[]>(`/llamadas?estado=${OPEN_CALL.join(',')}`, { token });
          tables = tables.map((table) => ({ ...table, llamada: calls.find((call) => call.espacio.id === table.espacio.id) ?? null }));
        } catch (error) {
          if (!missing(error)) throw error;
          callsEnabled = false;
        }
      }
      return { tables, callsEnabled: boardEndpoint || callsEnabled };
    },
    async transitionCall(call, target) {
      return request<TableCall>(`/llamadas/${call.id}/transiciones`, {
        token: await getToken(),
        method: 'POST',
        idempotent: true,
        body: { estado_objetivo: target, version_esperada: call.version },
      });
    },
    async deliver(order, qrToken) {
      await request<OrderDetail>(`/pedidos/${order.id}/transiciones`, {
        token: await getToken(),
        method: 'POST',
        idempotent: true,
        body: { estado_objetivo: 'entregado', version_esperada: order.version, qr_token: qrToken.trim() },
      });
    },
  };
}

// ---------------- buyer ----------------

export interface BuyerCallClient {
  current(espacioId: number): Promise<TableCall | null>;
  call(espacioId: number, motivo: CallReason, pedidoId: string | null): Promise<TableCall>;
  cancel(call: TableCall): Promise<TableCall>;
}

export class CallsUnavailableError extends Error {}

export function createBuyerCallClient(token: string): BuyerCallClient {
  const guard = async <T>(run: () => Promise<T>) => {
    try {
      return await run();
    } catch (error) {
      if (missing(error)) throw new CallsUnavailableError('Llamar al mesero todavía no está disponible en esta cafetería.');
      throw error;
    }
  };
  return {
    current: (espacioId) =>
      guard(async () => {
        const calls = await request<TableCall[]>(`/llamadas?estado=${OPEN_CALL.join(',')}`, { token });
        return calls.find((call) => call.espacio.id === espacioId) ?? null;
      }),
    call: (espacioId, motivo, pedidoId) =>
      guard(() =>
        request<TableCall>(`/espacios/${espacioId}/llamadas`, { token, method: 'POST', idempotent: true, body: { motivo, pedido_id: pedidoId } }),
      ),
    cancel: (call) => guard(() => request<TableCall>(`/llamadas/${call.id}/cancelaciones`, { token, method: 'POST', idempotent: true })),
  };
}
