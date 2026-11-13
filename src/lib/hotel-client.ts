// Las llamadas del huésped al modo Hotel (`docs/hotel.md`). Espejo de la región «Huésped» de
// `RemoteHotelRepository.kt` (Android). La sesión se pide en cada llamada porque la de invitado dura
// 15 minutos y se renueva con la llave del dispositivo; el cliente se inyecta para probar sin red.
import { request } from './api';
import { VaiinillaApiError } from './api-error';
import {
  parseHotelConfig,
  parseHotelRequest,
  parseHotelRequests,
  parseStay,
  type HotelConfig,
  type HotelRequest,
  type RequestType,
  type Stay,
} from './hotel';
import type { CreateOrderInput, OrderDetail } from '../types/api';

export interface HotelClient {
  /** La estancia vigente de esta cuenta; null si todavía no se ha ligado con el código. */
  myStay: (roomId?: number | null) => Promise<Stay | null>;
  /** Liga la cuenta con la estancia: el código de 6 dígitos y la habitación (por su QR o su id). */
  linkStay: (code: string, room: { qrToken?: string | null; roomId?: number | null }) => Promise<Stay>;
  config: () => Promise<HotelConfig>;
  setDoNotDisturb: (enabled: boolean) => Promise<Stay>;
  createRequest: (type: RequestType, quantity: number, note: string | null, idempotencyKey: string) => Promise<HotelRequest>;
  myRequests: () => Promise<HotelRequest[]>;
  cancelRequest: (id: string, idempotencyKey: string) => Promise<HotelRequest>;
  createOrder: (input: CreateOrderInput, idempotencyKey: string) => Promise<OrderDetail>;
}

/** El código de la puerta: solo un token de QR (`esp_…`) sirve como `qr_token`; un código corto no. */
export function isQrToken(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith('esp_');
}

export function createHotelClient(getToken: () => Promise<string>): HotelClient {
  return {
    async myStay(roomId) {
      const token = await getToken();
      const query = roomId ? `?espacio_id=${roomId}` : '';
      try {
        const response = await request<unknown>(`/estancias/mia${query}`, { token, cache: 'no-store' });
        return parseStay(response.data);
      } catch (cause) {
        // Sin estancia ligada el servidor contesta 404: no es un fallo, es «todavía no hay».
        if (cause instanceof VaiinillaApiError && cause.status === 404) return null;
        throw cause;
      }
    },
    async linkStay(code, room) {
      const token = await getToken();
      const body: Record<string, unknown> = { codigo: code.trim() };
      // El servidor exige uno solo de los dos; el QR manda cuando hay los dos.
      if (isQrToken(room.qrToken)) body.qr_token = room.qrToken;
      else if (room.roomId != null) body.espacio_id = room.roomId;
      const response = await request<unknown>('/estancias/vincular', { method: 'POST', token, body });
      return parseStay(response.data);
    },
    async config() {
      const token = await getToken();
      return parseHotelConfig((await request<unknown>('/hotel/configuracion', { token })).data);
    },
    async setDoNotDisturb(enabled) {
      const token = await getToken();
      const response = await request<unknown>('/estancias/mia', {
        method: 'PATCH',
        token,
        body: { no_molestar: enabled },
      });
      return parseStay(response.data);
    },
    async createRequest(type, quantity, note, idempotencyKey) {
      const token = await getToken();
      const body: Record<string, unknown> = { tipo: type, cantidad: quantity };
      if (note?.trim()) body.nota = note.trim();
      const response = await request<unknown>('/solicitudes-hotel', {
        method: 'POST',
        token,
        idempotencyKey,
        body,
      });
      return parseHotelRequest(response.data);
    },
    async myRequests() {
      const token = await getToken();
      const response = await request<unknown>('/solicitudes-hotel?estado=pendiente,tomada,resuelta,cancelada', {
        token,
        cache: 'no-store',
      });
      return parseHotelRequests(response.data);
    },
    async cancelRequest(id, idempotencyKey) {
      const token = await getToken();
      const response = await request<unknown>(`/solicitudes-hotel/${encodeURIComponent(id)}/cancelaciones`, {
        method: 'POST',
        token,
        idempotencyKey,
        body: {},
      });
      return parseHotelRequest(response.data);
    },
    async createOrder(input, idempotencyKey) {
      const token = await getToken();
      return (await request<OrderDetail>('/pedidos', { method: 'POST', token, idempotencyKey, body: input })).data;
    },
  };
}
