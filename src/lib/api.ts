import { VaiinillaApiError } from './api-error';
import { createIdempotencyKey } from './idempotency';
import { resolveApiUrl } from './env';
import type {
  ApiEnvelope,
  GuestSessionResponse,
  TrackedOrder,
  SharedTable,
  ApiErrorEnvelope,
  CatalogResponse,
  ClientContextResponse,
  CreateOrderInput,
  IdentityRegistration,
  IdentityRegistrationInput,
  LegalVersions,
  OperationalStatus,
  OrderDetail,
  PublicEstablishment,
  SessionAccess,
  StripePaymentSession,
  WalletData,
} from '../types/api';
import { parseStripePaymentSession } from './stripe-session';
import { normalizeResolvedSpace, type ResolvedTableSpace } from './resolved-space';
import {
  parseCourtDay,
  parseReservation,
  parseReservationPayment,
  parseReservations,
  type CourtDay,
  type Reservation,
  type ReservationPayment,
  type ReservationPaymentMethod,
} from './reservations';
import { cachedResource, resourceKeys } from './resource-cache';

const PUBLIC_DATA_MAX_AGE_MS = 60_000;

const apiUrl = resolveApiUrl(import.meta.env.VITE_API_URL);

interface RequestOptions extends Omit<RequestInit, 'body'> {
  token?: string;
  body?: unknown;
  idempotent?: boolean;
  idempotencyKey?: string;
}

/** Cliente HTTP único del backend: encabezados, Idempotency-Key, sobre `{ data, error }` y errores. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const { token, body, idempotent, idempotencyKey, ...requestOptions } = options;
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
  else if (idempotent) headers.set('Idempotency-Key', createIdempotencyKey());

  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...requestOptions,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new VaiinillaApiError(0, {
      code: 'BACKEND_UNAVAILABLE',
      message: 'El servicio no está disponible. Inténtalo de nuevo en un momento.',
    });
  }

  if (response.ok && response.status === 204) {
    return { data: undefined as T, meta: {}, error: null };
  }

  const payload = (await response.json().catch(() => null)) as
    | ApiEnvelope<T>
    | ApiErrorEnvelope
    | null;

  if (!response.ok || !payload || payload.error) {
    const error = payload?.error ?? {
      code: 'HTTP_ERROR',
      message: 'El servidor no devolvió una respuesta válida.',
    };
    const retryAfter = Number(response.headers.get('Retry-After')) || undefined;
    throw new VaiinillaApiError(response.status, error, retryAfter);
  }

  return payload;
}

function params(values: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

/** Palabra que el backend exige para borrar la cuenta (DELETE /identidad/cuenta). */
export const ACCOUNT_DELETION_CONFIRMATION = 'ELIMINAR';

export const api = {
  apiUrl,

  async listEstablishments(
    query = '',
    cursor?: string,
    limit = 50,
    near?: { latitud: number; longitud: number },
  ): Promise<{ establishments: PublicEstablishment[]; cursor: string | null }> {
    // The API requires both coordinates together; it then sorts nearest first.
    const response = await request<PublicEstablishment[]>(
      `/publico/establecimientos${params({ query, cursor, limit, latitud: near?.latitud, longitud: near?.longitud })}`,
    );
    return { establishments: response.data, cursor: response.meta.cursor ?? null };
  },

  // El negocio y su catálogo cambian poco: se guardan un minuto para que cambiar de
  // pestaña en el dock no los vuelva a bajar.
  async getEstablishment(slug: string): Promise<PublicEstablishment> {
    return cachedResource(resourceKeys.establishment(slug), PUBLIC_DATA_MAX_AGE_MS, async () =>
      (await request<PublicEstablishment>(`/publico/establecimientos/${slug}`)).data);
  },

  async getGuestCatalog(slug: string): Promise<CatalogResponse> {
    return cachedResource(resourceKeys.catalog(slug), PUBLIC_DATA_MAX_AGE_MS, async () =>
      (await request<CatalogResponse>(`/publico/establecimientos/${slug}/catalogo`)).data);
  },

  /** Compra sin cuenta: alta con solo el nombre. La llave se guarda en el dispositivo. */
  async createGuest(input: {
    slug: string;
    nombre: string;
    terminosVersion: string;
    privacidadVersion: string;
  }): Promise<GuestSessionResponse> {
    return (
      await request<GuestSessionResponse>('/publico/invitados', {
        method: 'POST',
        body: {
          establecimiento_slug: input.slug,
          nombre: input.nombre,
          terminos_version: input.terminosVersion,
          privacidad_version: input.privacidadVersion,
        },
      })
    ).data;
  },

  /** Otra sesión de invitado (15 min) con la llave del dispositivo. */
  async renewGuest(slug: string, llave: string): Promise<GuestSessionResponse> {
    return (
      await request<GuestSessionResponse>('/publico/invitados/sesiones', {
        method: 'POST',
        body: { establecimiento_slug: slug, llave },
      })
    ).data;
  },

  /** El pedido de un invitado por su enlace de seguimiento (solo lectura). */
  async getTracking(token: string): Promise<TrackedOrder> {
    return (await request<TrackedOrder>(`/publico/seguimiento/${encodeURIComponent(token)}`, { cache: 'no-store' })).data;
  },

  /** "Tus pedidos" sin cuenta: en vivo con la llave del navegador, formato de cuenta. */
  async listGuestOrders(slug: string, llave: string): Promise<TrackedOrder[]> {
    return (
      await request<TrackedOrder[]>('/publico/invitados/pedidos', {
        method: 'POST',
        body: { establecimiento_slug: slug, llave },
        cache: 'no-store',
      })
    ).data;
  },

  async getLegalVersions(): Promise<LegalVersions> {
    return (await request<LegalVersions>('/publico/legal/vigente')).data;
  },

  /** Correo de verificación: el backend genera el enlace y lo envía (202 aunque sea asíncrono). */
  async sendVerificationEmail(firebaseToken: string): Promise<{ aceptado: boolean }> {
    return (
      await request<{ aceptado: boolean }>('/publico/correos/verificacion', {
        method: 'POST',
        token: firebaseToken,
      })
    ).data;
  },

  async registerIdentity(
    firebaseToken: string,
    input: IdentityRegistrationInput,
  ): Promise<IdentityRegistration> {
    return (
      await request<IdentityRegistration>('/identidad/alta', {
        method: 'POST',
        token: firebaseToken,
        idempotent: true,
        body: input,
      })
    ).data;
  },

  async listAccesses(firebaseToken: string): Promise<SessionAccess[]> {
    return (await request<SessionAccess[]>('/sesiones/accesos', { token: firebaseToken })).data;
  },

  async createClientContext(
    firebaseToken: string,
    establecimientoSlug: string,
    identificadorCliente?: string | null,
  ): Promise<ClientContextResponse> {
    return (
      await request<ClientContextResponse>('/sesiones/contexto-cliente', {
        method: 'POST',
        token: firebaseToken,
        idempotent: true,
        body: {
          establecimiento_slug: establecimientoSlug,
          identificador_cliente: identificadorCliente ?? null,
        },
      })
    ).data;
  },

  async getOperationalStatus(token: string): Promise<OperationalStatus> {
    return (await request<OperationalStatus>('/estado-operativo', { token })).data;
  },

  async createOrder(token: string, input: CreateOrderInput, idempotencyKey: string): Promise<OrderDetail> {
    return (
      await request<OrderDetail>('/pedidos', {
        method: 'POST',
        token,
        idempotencyKey,
        body: input,
      })
    ).data;
  },

  /** Se une a la mesa del QR con un alias que escribe el cliente. */
  async joinTable(token: string, qrToken: string, alias: string): Promise<SharedTable> {
    return (await request<SharedTable>('/mesas/unirse', { token, method: 'POST', body: { token: qrToken, alias } })).data;
  },

  /** La mesa del cliente, o null si no está en ninguna. */
  async currentTable(token: string): Promise<SharedTable | null> {
    return (await request<SharedTable | null>('/mesas/actual', { token })).data;
  },

  /** "Esto lo pago yo" (o ya no) sobre un pedido de la cuenta de la mesa. */
  async claimTableOrder(token: string, folio: number, payIt: boolean): Promise<SharedTable> {
    return (
      await request<SharedTable>('/mesas/actual/reclamos', { token, method: 'POST', body: { folio, pago_yo: payIt } })
    ).data;
  },

  async leaveTable(token: string): Promise<void> {
    await request<null>('/mesas/actual/salida', { token, method: 'POST' });
  },

  async listOrders(
    token: string,
    cursor?: string,
  ): Promise<{ orders: OrderDetail[]; cursor: string | null }> {
    const response = await request<OrderDetail[]>(`/pedidos${params({ cursor, limit: 30 })}`, {
      token,
    });
    return { orders: response.data, cursor: response.meta.cursor ?? null };
  },

  async getOrder(token: string, id: string): Promise<OrderDetail> {
    // El detalle contiene el estado de un pago Stripe recién confirmado. En el
    // navegador no puede reutilizar una respuesta HTTP anterior: el webhook es
    // la fuente de verdad y el polling debe observar su actualización enseguida.
    return (await request<OrderDetail>(`/pedidos/${id}`, { token, cache: 'no-store' })).data;
  },

  async getOrderQr(token: string, id: string): Promise<{ qr_token: string }> {
    return (await request<{ qr_token: string }>(`/pedidos/${id}/qr`, { token })).data;
  },

  /** "Ya llegué" (drive-thru): sin cuerpo; avisar otra vez conserva la primera hora. */
  async announceArrival(token: string, id: string): Promise<OrderDetail> {
    return (await request<OrderDetail>(`/pedidos/${id}/llegada`, { method: 'POST', token })).data;
  },

  async getMyWallet(token: string): Promise<WalletData> {
    return (await request<WalletData>('/wallets/me', { token })).data;
  },

  async resolveSpace(token: string, slug?: string): Promise<ResolvedTableSpace> {
    const response = await request<unknown>('/publico/espacios/resolver', {
      method: 'POST',
      body: { token, establecimiento_slug: slug ?? null },
    });
    return normalizeResolvedSpace(response.data, slug);
  },

  /** Espacios del negocio con su precio por hora (sin sesión): decide si se ofrece "Rentar cancha". */
  async getPublicSpaces(slug: string): Promise<Array<{ espacio?: { tipo?: string }; precio_hora?: string | null }>> {
    return (
      await request<Array<{ espacio?: { tipo?: string }; precio_hora?: string | null }>>(
        `/publico/establecimientos/${slug}/disponibilidad`,
      )
    ).data;
  },

  async getCourtDay(token: string, date?: string): Promise<CourtDay> {
    const response = await request<unknown>(`/reservas/disponibilidad${params({ fecha: date })}`, {
      token,
      cache: 'no-store',
    });
    return parseCourtDay(response.data);
  },

  async listReservations(token: string): Promise<Reservation[]> {
    const response = await request<unknown>('/reservas', { token, cache: 'no-store' });
    return parseReservations(response.data);
  },

  async createReservation(
    token: string,
    input: { courtId: number; start: number | null; durationMinutes: number },
    idempotencyKey: string,
  ): Promise<Reservation> {
    const response = await request<unknown>('/reservas', {
      method: 'POST',
      token,
      idempotencyKey,
      body: {
        espacio_id: input.courtId,
        ...(input.start === null ? {} : { inicio: new Date(input.start).toISOString() }),
        duracion_min: input.durationMinutes,
      },
    });
    return parseReservation(response.data);
  },

  async payReservation(
    token: string,
    id: string,
    method: ReservationPaymentMethod,
    idempotencyKey: string,
  ): Promise<ReservationPayment> {
    const response = await request<unknown>(`/reservas/${id}/pago`, {
      method: 'POST',
      token,
      idempotencyKey,
      body: { metodo_pago: method },
    });
    return parseReservationPayment(response.data);
  },

  async cancelReservation(token: string, id: string, idempotencyKey: string): Promise<Reservation> {
    const response = await request<unknown>(`/reservas/${id}/cancelacion`, {
      method: 'POST',
      token,
      idempotencyKey,
    });
    return parseReservation(response.data);
  },

  async deleteIdentity(firebaseToken: string): Promise<void> {
    await request<unknown>('/identidad/cuenta', {
      method: 'DELETE',
      token: firebaseToken,
      idempotent: true,
      body: { confirmacion: ACCOUNT_DELETION_CONFIRMATION },
    });
  },

  async retryStripePayment(
    token: string,
    orderId: string,
    idempotencyKey: string,
  ): Promise<StripePaymentSession> {
    const response = await request<unknown>(`/pedidos/${orderId}/pago/stripe`, {
      method: 'POST',
      token,
      idempotencyKey,
    });
    return parseStripePaymentSession(response.data);
  },
};
