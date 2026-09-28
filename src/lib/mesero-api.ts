// Buyer side of "Llamar al mesero". Contract: docs/mesero-backend.md.
// The waiter (staff) side of this feature moved to vaiinilla-web.
import { api } from './api';
import { VaiinillaApiError } from './api-error';
import { createIdempotencyKey } from './idempotency';
import type { ApiEnvelope, ApiErrorEnvelope } from '../types/api';

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
