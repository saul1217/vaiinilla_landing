// Buyer side of "Llamar al mesero". Contract: vaiinilla_back docs/llamadas-mesa.md.
// The waiter (staff) side of this feature moved to vaiinilla-web.
import { request as apiRequest } from './api';
import { VaiinillaApiError } from './api-error';
import type { OrderDetail } from '../types/api';

export type CallReason = 'atencion' | 'utensilios' | 'problema' | 'cuenta';
export type CallStatus = 'pendiente' | 'en_camino' | 'atendida' | 'cancelada' | 'expirada';

export const CALL_REASONS: { value: CallReason; label: string }[] = [
  { value: 'cuenta', label: 'Pedir cuenta' },
  { value: 'atencion', label: 'Necesito algo' },
  { value: 'utensilios', label: 'Cubiertos o servilletas' },
  { value: 'problema', label: 'Algo está mal con mi pedido' },
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

export const OPEN_CALL: CallStatus[] = ['pendiente', 'en_camino'];

// The backend only accepts calls from table orders still in progress (or delivered < 2 h).
const CLOSED_ORDER_STATES = new Set(['cancelado', 'no_recogido', 'expirado']);

export function canCallWaiter(order: OrderDetail) {
  return order.destino === 'en_espacio' && Boolean(order.espacio) && !CLOSED_ORDER_STATES.has(order.estado);
}

async function request<T>(path: string, init: { token: string; method?: string; body?: unknown; idempotent?: boolean }): Promise<T> {
  return (await apiRequest<T>(path, init)).data;
}

const missing = (error: unknown) => error instanceof VaiinillaApiError && (error.status === 404 || error.status === 405 || error.status === 501);

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
