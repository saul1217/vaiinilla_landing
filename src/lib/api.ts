import { VaiinillaApiError } from './api-error';
import { createIdempotencyKey } from './idempotency';
import { resolveApiUrl } from './env';
import type {
  ApiEnvelope,
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

const hostname = typeof window === 'undefined' ? '' : window.location.hostname;
const apiUrl = resolveApiUrl(import.meta.env.VITE_API_URL, hostname);

interface RequestOptions extends Omit<RequestInit, 'body'> {
  token?: string;
  body?: unknown;
  idempotent?: boolean;
  idempotencyKey?: string;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiEnvelope<T>> {
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

  async getEstablishment(slug: string): Promise<PublicEstablishment> {
    return (await request<PublicEstablishment>(`/publico/establecimientos/${slug}`)).data;
  },

  async getGuestCatalog(slug: string): Promise<CatalogResponse> {
    return (await request<CatalogResponse>(`/publico/establecimientos/${slug}/catalogo`)).data;
  },

  async getLegalVersions(): Promise<LegalVersions> {
    return (await request<LegalVersions>('/publico/legal/vigente')).data;
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

  async deleteIdentity(firebaseToken: string): Promise<void> {
    await request<unknown>('/identidad/cuenta', {
      method: 'DELETE',
      token: firebaseToken,
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
