import {
  clearTableDeviceTokens,
  pruneTableDeviceTokens,
  saveTableDeviceToken,
  tableDeviceToken,
} from './table-device-token';
import { VaiinillaApiError } from './api-error';
import { createIdempotencyKey } from './idempotency';
import { VERIFICATION_EMAIL_LANGUAGE, resolveApiUrl, verificationReturnUrl } from './env';
import type {
  ApiEnvelope,
  ClaimGuestOrdersResponse,
  GuestSessionResponse,
  TrackedOrder,
  SharedTable,
  TableSession,
  ApiErrorEnvelope,
  CardReload,
  CardReloadCheckout,
  CatalogResponse,
  ClientContextResponse,
  CreateOrderInput,
  HomeDeliveryQuote,
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
import {
  encodeWeekOrders,
  parseChildMenuCalendar,
  parseDependent,
  parseDependents,
  parseLinkCode,
  parseMyControls,
  parsePrivacyNotice,
  parseStudentRequest,
  parseStudentRequests,
  type ChildMenuCalendar,
  type Dependent,
  type DependentContextGrant,
  type LinkCode,
  type MyGuardianControls,
  type PrivacyNotice,
  type RefundMethod,
  type ScheduledDayOrder,
  type StudentRequest,
  type StudentRequestKind,
} from './guardianship';

const PUBLIC_DATA_MAX_AGE_MS = 60_000;

const apiUrl = resolveApiUrl(import.meta.env.VITE_API_URL);

interface RequestOptions extends Omit<RequestInit, 'body'> {
  token?: string;
  body?: unknown;
  idempotent?: boolean;
  idempotencyKey?: string;
  /**
   * Si un 401 cierra la sesión del comprador (por defecto sí). Las llamadas con el token de un
   * hijo (modo papás) lo apagan: un token del hijo vencido se renueva, no saca al tutor.
   */
  notifyOnUnauthorized?: boolean;
}

import { notifyUnauthorized, onUnauthorizedSession, type UnauthorizedListener } from './unauthorized';
export { notifyUnauthorized, onUnauthorizedSession, type UnauthorizedListener };

/** Cliente HTTP único del backend: encabezados, Idempotency-Key, sobre `{ data, error }` y errores. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const { token, body, idempotent, idempotencyKey, notifyOnUnauthorized = true, ...requestOptions } = options;
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
    if (response.status === 401 && notifyOnUnauthorized) {
      notifyUnauthorized();
    }
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

/** Tope de páginas de `GET /pedidos`: 20 × 100 pedidos sobra para una cuenta y evita un ciclo sin fin. */
const ORDER_PAGE_SIZE = 100;
const ORDER_PAGE_LIMIT = 20;

/**
 * Todos los pedidos de quien firma el token, del más nuevo al más viejo. El servidor los ordena del más viejo
 * al más nuevo y pagina con cursor: quedarse con la primera página deja fuera los pedidos de hoy en una cuenta
 * con más de una página.
 */
async function listAllOrders(token: string, options: Pick<RequestOptions, 'cache' | 'notifyOnUnauthorized'> = {}): Promise<OrderDetail[]> {
  const orders: OrderDetail[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < ORDER_PAGE_LIMIT; page += 1) {
    const response = await request<OrderDetail[]>(`/pedidos${params({ cursor, limit: ORDER_PAGE_SIZE })}`, {
      token,
      ...options,
    });
    orders.push(...response.data);
    cursor = response.meta.cursor ?? undefined;
    if (!cursor || response.data.length === 0) break;
  }
  // El cursor va por `actualizado_en`: un pedido que cambia entre una página y otra vuelve a salir más adelante.
  const latest = new Map<string, OrderDetail>();
  for (const order of orders) {
    const seen = latest.get(order.id);
    if (!seen || order.actualizado_en >= seen.actualizado_en) latest.set(order.id, order);
  }
  return [...latest.values()].sort((a, b) => b.creado_en.localeCompare(a.creado_en) || b.id.localeCompare(a.id));
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
    nombre?: string;
    terminosVersion: string;
    privacidadVersion: string;
    /** Token del QR/NFC escaneado: prueba de presencia para apartar canchas. */
    espacioToken?: string;
    entradaToken?: string;
  }): Promise<GuestSessionResponse> {
    const body: Record<string, unknown> = {
      establecimiento_slug: input.slug,
      terminos_version: input.terminosVersion,
      privacidad_version: input.privacidadVersion,
    };
    // Sin nombre: invitado anónimo para la mesa (el alias del participante es lo visible).
    if (input.nombre !== undefined && input.nombre.trim() !== '') body.nombre = input.nombre;
    if (input.entradaToken) body.entrada_token = input.entradaToken;
    else if (input.espacioToken) body.espacio_token = input.espacioToken;
    return (
      await request<GuestSessionResponse>('/publico/invitados', {
        method: 'POST',
        body,
      })
    ).data;
  },

  /** Otra sesión de invitado (15 min) con la llave del dispositivo. */
  async renewGuest(
    slug: string,
    llave: string,
    proof: { espacioToken?: string; entradaToken?: string } = {},
  ): Promise<GuestSessionResponse> {
    const body: Record<string, unknown> = { establecimiento_slug: slug, llave };
    if (proof.entradaToken) body.entrada_token = proof.entradaToken;
    else if (proof.espacioToken) body.espacio_token = proof.espacioToken;
    return (
      await request<GuestSessionResponse>('/publico/invitados/sesiones', {
        method: 'POST',
        body,
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

  /**
   * "Estos pedidos eran míos": pasa los pedidos del invitado a la cuenta.
   * La llave es la prueba de propiedad; repetirlo mueve cero filas.
   */
  async claimGuestOrders(firebaseToken: string, llave: string): Promise<ClaimGuestOrdersResponse> {
    return (
      await request<ClaimGuestOrdersResponse>('/invitados/reclamar', {
        method: 'POST',
        token: firebaseToken,
        body: { llave },
        cache: 'no-store',
      })
    ).data;
  },

  async getLegalVersions(): Promise<LegalVersions> {
    return (await request<LegalVersions>('/publico/legal/vigente')).data;
  },

  /** Correo de verificación: el backend genera el enlace y lo envía (202 aunque sea asíncrono). */
  async sendVerificationEmail(firebaseToken: string): Promise<{ aceptado: boolean }> {
    const send = (body?: { continue_url: string; idioma?: string }) =>
      request<{ aceptado: boolean }>('/publico/correos/verificacion', {
        method: 'POST',
        token: firebaseToken,
        body,
      });
    // El enlace debe regresar a esta landing (no al panel de la plantilla) y en el idioma de la
    // landing (es), no el inglés por defecto. Un backend que aún no acepta un campo no debe
    // bloquear el registro: se reintenta con menos campos.
    const attempts = [
      { continue_url: verificationReturnUrl(), idioma: VERIFICATION_EMAIL_LANGUAGE },
      { continue_url: verificationReturnUrl() },
      undefined,
    ];
    let lastError: unknown;
    for (const body of attempts) {
      try {
        return (await send(body)).data;
      } catch (cause) {
        if (!(cause instanceof VaiinillaApiError && (cause.status === 400 || cause.status === 422))) throw cause;
        lastError = cause;
      }
    }
    throw lastError;
  },

  /**
   * Correo de recuperación de contraseña: lo envía el backend con la marca de Vaiinilla (Resend),
   * no la plantilla de Firebase. Responde 202 exista o no la cuenta (anti-enumeración).
   */
  async sendPasswordRecoveryEmail(email: string): Promise<void> {
    // `continue_url` hace que el enlace regrese a esta web (/acceso/recuperar), no al panel.
    await request<{ aceptado: boolean }>('/publico/correos/recuperacion', {
      method: 'POST',
      body: { email: email.trim().toLowerCase(), continue_url: verificationReturnUrl() },
    });
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

  /** ¿El reparto del negocio llega a ese punto y cuánto cuesta? (POST /pedidos/reparto/cotizar). */
  async quoteHomeDelivery(token: string, lat: number, lng: number): Promise<HomeDeliveryQuote> {
    return (
      await request<HomeDeliveryQuote>('/pedidos/reparto/cotizar', {
        method: 'POST',
        token,
        idempotent: true,
        body: { lat, lng },
      })
    ).data;
  },

  /** Sesión activa de la mesa por su QR: participantes y quién soy (rol cliente). */
  async tableSession(token: string, qrToken: string): Promise<TableSession> {
    return (
      await request<TableSession>(`/mesas/espacio/${encodeURIComponent(qrToken)}`, { token })
    ).data;
  },

  /**
   * Se une a la mesa del QR: con `{ alias }` crea (o renombra el mío), con
   * `{ participanteId }` continúa como ese participante. Acepta el alias suelto
   * por compatibilidad con llamadas existentes.
   */
  async joinTable(
    token: string,
    qrToken: string,
    input: string | { alias: string } | { participanteId: string },
  ): Promise<SharedTable> {
    const body =
      typeof input === 'string'
        ? { token: qrToken, alias: input }
        : 'alias' in input
          ? { token: qrToken, alias: input.alias }
          : {
              token: qrToken,
              participante_id: input.participanteId,
              // Prueba de que este teléfono es ese participante (si alguna vez lo fue).
              ...(tableDeviceToken(input.participanteId)
                ? { dispositivo_token: tableDeviceToken(input.participanteId) }
                : {}),
            };
    const table = (await request<SharedTable>('/mesas/unirse', { token, method: 'POST', body })).data;
    if (table?.dispositivo_token && table.mi_participante?.id) {
      saveTableDeviceToken(table.mi_participante.id, table.dispositivo_token, table.sesion_id ?? null);
    }
    return table;
  },

  /** La mesa del cliente, o null si no está en ninguna. */
  async currentTable(token: string): Promise<SharedTable | null> {
    const table = (await request<SharedTable | null>('/mesas/actual', { token })).data;
    // Sin mesa vigente (salió o la sesión se cerró): los tokens de dispositivo ya no sirven.
    if (!table) clearTableDeviceTokens();
    else if (table.sesion_id) pruneTableDeviceTokens(table.sesion_id);
    return table;
  },

  /** "Esto lo pago yo" (o ya no) sobre un pedido de la cuenta de la mesa. */
  async claimTableOrder(token: string, folio: number, payIt: boolean): Promise<SharedTable> {
    return (
      await request<SharedTable>('/mesas/actual/reclamos', { token, method: 'POST', body: { folio, pago_yo: payIt } })
    ).data;
  },

  async leaveTable(token: string): Promise<void> {
    await request<null>('/mesas/actual/salida', { token, method: 'POST' });
    clearTableDeviceTokens();
  },

  async listOrders(token: string): Promise<{ orders: OrderDetail[] }> {
    return { orders: await listAllOrders(token) };
  },

  async getOrder(token: string, id: string): Promise<OrderDetail> {
    // El detalle contiene el estado de un pago Stripe recién confirmado. En el
    // navegador no puede reutilizar una respuesta HTTP anterior: el webhook es
    // la fuente de verdad y el polling debe observar su actualización enseguida.
    return (await request<OrderDetail>(`/pedidos/${id}`, { token, cache: 'no-store' })).data;
  },

  async getOrderQr(token: string, id: string): Promise<{ qr_token: string; codigo_recoger?: string | null }> {
    return (await request<{ qr_token: string; codigo_recoger?: string | null }>(`/pedidos/${id}/qr`, { token })).data;
  },

  /** "Ya llegué" (drive-thru): sin cuerpo; avisar otra vez conserva la primera hora. */
  async announceArrival(token: string, id: string): Promise<OrderDetail> {
    return (await request<OrderDetail>(`/pedidos/${id}/llegada`, { method: 'POST', token })).data;
  },

  async getMyWallet(token: string): Promise<WalletData> {
    return (await request<WalletData>('/wallets/me', { token })).data;
  },

  /** Recarga con tarjeta: crea el PaymentIntent; el saldo llega cuando el webhook confirma el pago. */
  async startCardReload(token: string, monto: string, idempotencyKey: string): Promise<CardReloadCheckout> {
    return (
      await request<CardReloadCheckout>('/wallets/me/recargas-stripe', {
        method: 'POST',
        token,
        body: { monto },
        idempotencyKey,
      })
    ).data;
  },

  async getCardReload(token: string, id: string): Promise<CardReload> {
    return (
      await request<{ recarga: CardReload }>(`/wallets/me/recargas-stripe/${encodeURIComponent(id)}`, { token })
    ).data.recarga;
  },

  // Modo papás (padres e hijos). Las rutas ya existen en el backend de develop.

  /** Recarga con tarjeta a la cartera del hijo, con su token (un 401 no cierra la sesión del tutor). */
  async startDependentCardReload(childToken: string, monto: string, idempotencyKey: string): Promise<CardReloadCheckout> {
    return (
      await request<CardReloadCheckout>('/wallets/me/recargas-stripe', {
        method: 'POST',
        token: childToken,
        body: { monto },
        idempotencyKey,
        notifyOnUnauthorized: false,
      })
    ).data;
  },

  async getDependentCardReload(childToken: string, id: string): Promise<CardReload> {
    return (
      await request<{ recarga: CardReload }>(`/wallets/me/recargas-stripe/${encodeURIComponent(id)}`, {
        token: childToken,
        cache: 'no-store',
        notifyOnUnauthorized: false,
      })
    ).data.recarga;
  },

  /** Hijos del tutor en este negocio (`GET /tutelas`), con el contexto de cliente del tutor. */
  async listDependents(token: string): Promise<Dependent[]> {
    return parseDependents((await request<unknown>('/tutelas', { token, cache: 'no-store' })).data);
  },

  /** Contexto del hijo para leer su cartera y sus pedidos. Cada emisión lleva su propia llave. */
  async issueDependentContext(token: string, dependentId: string): Promise<DependentContextGrant> {
    return (
      await request<DependentContextGrant>(`/tutelas/${encodeURIComponent(dependentId)}/contexto`, {
        method: 'POST',
        token,
        idempotent: true,
      })
    ).data;
  },

  /** Cartera del hijo (saldo y movimientos) con su token. */
  async getDependentWallet(childToken: string): Promise<WalletData> {
    return (
      await request<WalletData>('/wallets/me', { token: childToken, cache: 'no-store', notifyOnUnauthorized: false })
    ).data;
  },

  /** Pedidos del hijo con su token (lo que compró en Caja, en su app o lo que se le apartó). */
  async listDependentOrders(childToken: string): Promise<OrderDetail[]> {
    return listAllOrders(childToken, { cache: 'no-store', notifyOnUnauthorized: false });
  },

  async getGuardianPrivacyNotice(token: string): Promise<PrivacyNotice | null> {
    return parsePrivacyNotice((await request<unknown>('/tutelas/consentimiento', { token })).data);
  },

  /** Acepta el aviso vigente para todos los hijos que no lo tienen; responde la lista actualizada. */
  async acceptGuardianPrivacyNotice(token: string, version: string, idempotencyKey: string): Promise<Dependent[]> {
    return parseDependents(
      (
        await request<unknown>('/tutelas/consentimiento', {
          method: 'POST',
          token,
          idempotencyKey,
          body: { consentimiento_version: version },
        })
      ).data,
    );
  },

  /** Con el código de la escuela, el tutor puede agregar hijos (`tutor_habilitado` de estado-operativo). */
  async unlockParent(token: string, schoolCode: string, idempotencyKey: string): Promise<void> {
    await request<unknown>('/tutelas/habilitar', {
      method: 'POST',
      token,
      idempotencyKey,
      body: { codigo_union: schoolCode },
    });
  },

  async addDependent(
    token: string,
    input: { name: string; studentId: string; group: string | null; consentVersion: string },
    idempotencyKey: string,
  ): Promise<Dependent | null> {
    const body: Record<string, unknown> = { nombre: input.name.trim(), matricula: input.studentId.trim() };
    const group = input.group?.trim();
    if (group) body.grupo = group;
    body.consentimiento_version = input.consentVersion;
    return parseDependent(
      (await request<unknown>('/tutelas/dependientes', { method: 'POST', token, idempotencyKey, body })).data,
    );
  },

  async linkDependent(token: string, code: string, consentVersion: string, idempotencyKey: string): Promise<Dependent | null> {
    return parseDependent(
      (
        await request<unknown>('/tutelas/vincular', {
          method: 'POST',
          token,
          idempotencyKey,
          body: { codigo: code, consentimiento_version: consentVersion },
        })
      ).data,
    );
  },

  /** El principal cambia todo; los demás tutores solo pueden mandar `umbral_saldo_bajo`. */
  async updateDependent(
    token: string,
    dependentId: string,
    body: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<Dependent | null> {
    return parseDependent(
      (
        await request<unknown>(`/tutelas/${encodeURIComponent(dependentId)}`, {
          method: 'PATCH',
          token,
          idempotencyKey,
          body,
        })
      ).data,
    );
  },

  async unlinkDependent(token: string, dependentId: string, idempotencyKey: string): Promise<void> {
    await request<unknown>(`/tutelas/${encodeURIComponent(dependentId)}`, { method: 'DELETE', token, idempotencyKey });
  },

  async createGuardianInviteCode(token: string, dependentId: string, idempotencyKey: string): Promise<LinkCode> {
    return parseLinkCode(
      (
        await request<unknown>(`/tutelas/${encodeURIComponent(dependentId)}/codigo-tutor`, {
          method: 'POST',
          token,
          idempotencyKey,
        })
      ).data,
    );
  },

  async createOwnAccountCode(token: string, dependentId: string, idempotencyKey: string): Promise<LinkCode> {
    return parseLinkCode(
      (
        await request<unknown>(`/tutelas/${encodeURIComponent(dependentId)}/codigo-cuenta`, {
          method: 'POST',
          token,
          idempotencyKey,
        })
      ).data,
    );
  },

  async removeGuardian(token: string, dependentId: string, guardianshipId: string, idempotencyKey: string): Promise<Dependent | null> {
    return parseDependent(
      (
        await request<unknown>(
          `/tutelas/${encodeURIComponent(dependentId)}/tutores/${encodeURIComponent(guardianshipId)}`,
          { method: 'DELETE', token, idempotencyKey },
        )
      ).data,
    );
  },

  async makePrincipalGuardian(
    token: string,
    dependentId: string,
    guardianshipId: string,
    idempotencyKey: string,
  ): Promise<Dependent | null> {
    return parseDependent(
      (
        await request<unknown>(
          `/tutelas/${encodeURIComponent(dependentId)}/tutores/${encodeURIComponent(guardianshipId)}/principal`,
          { method: 'POST', token, idempotencyKey },
        )
      ).data,
    );
  },

  /** `pin` nulo quita el PIN. */
  async setDependentPin(token: string, dependentId: string, pin: string | null, idempotencyKey: string): Promise<void> {
    const path = `/tutelas/${encodeURIComponent(dependentId)}/pin`;
    await request<unknown>(
      path,
      pin !== null ? { method: 'PUT', token, idempotencyKey, body: { pin } } : { method: 'DELETE', token, idempotencyKey },
    );
  },

  /** Deja sin servir su QR y su tarjeta; responde cuántas credenciales se bloquearon. */
  async blockDependentCredentials(token: string, dependentId: string, idempotencyKey: string): Promise<number> {
    const data = (
      await request<{ bloqueadas?: number }>(`/tutelas/${encodeURIComponent(dependentId)}/credenciales/bloquear`, {
        method: 'POST',
        token,
        idempotencyKey,
      })
    ).data;
    return typeof data?.bloqueadas === 'number' ? data.bloqueadas : 0;
  },

  async listStudentRequests(token: string, dependentId: string): Promise<StudentRequest[]> {
    return parseStudentRequests(
      (await request<unknown>(`/tutelas/${encodeURIComponent(dependentId)}/solicitudes`, { token, cache: 'no-store' })).data,
    );
  },

  async createStudentRequest(
    token: string,
    dependentId: string,
    input: { kind: StudentRequestKind; refundMethod: RefundMethod | null; note: string | null },
    idempotencyKey: string,
  ): Promise<StudentRequest | null> {
    const body: Record<string, unknown> = { tipo: input.kind };
    if (input.kind === 'devolucion' && input.refundMethod) body.como_devolver = input.refundMethod;
    const note = input.note?.trim();
    if (note) body.nota = note;
    return parseStudentRequest(
      (
        await request<unknown>(`/tutelas/${encodeURIComponent(dependentId)}/solicitudes`, {
          method: 'POST',
          token,
          idempotencyKey,
          body,
        })
      ).data,
    );
  },

  /** El alumno saca un código para que su tutor lo agregue. */
  async createStudentLinkCode(token: string, idempotencyKey: string): Promise<LinkCode> {
    return parseLinkCode((await request<unknown>('/tutelas/codigos-vinculo', { method: 'POST', token, idempotencyKey })).data);
  },

  /** El alumno se queda con la cuenta que le abrió su tutor; responde su nombre. */
  async claimStudentAccount(token: string, code: string, idempotencyKey: string): Promise<string> {
    const data = (
      await request<{ nombre?: string }>('/tutelas/reclamar-cuenta', {
        method: 'POST',
        token,
        idempotencyKey,
        body: { codigo: code },
      })
    ).data;
    return typeof data?.nombre === 'string' ? data.nombre : '';
  },

  /** Lo que sus tutores le pusieron al alumno; nulo si nadie lo cuida en este negocio. */
  async getMyGuardianControls(token: string): Promise<MyGuardianControls | null> {
    return parseMyControls((await request<unknown>('/tutelas/mis-controles', { token, cache: 'no-store' })).data);
  },

  /** Los controles del hijo vistos por él (qué no se le vende), con su token. */
  async getDependentControls(childToken: string): Promise<MyGuardianControls | null> {
    return parseMyControls(
      (await request<unknown>('/tutelas/mis-controles', { token: childToken, cache: 'no-store', notifyOnUnauthorized: false })).data,
    );
  },

  /** Menú por día de la escuela, con el token del hijo. */
  async getDependentMenuCalendar(childToken: string): Promise<ChildMenuCalendar> {
    return parseChildMenuCalendar(
      (await request<unknown>('/menu-dias', { token: childToken, cache: 'no-store', notifyOnUnauthorized: false })).data,
    );
  },

  /** Aparta la comida de varios días; responde cuántos pedidos se crearon. */
  async reserveDependentWeek(childToken: string, days: ScheduledDayOrder[], idempotencyKey: string): Promise<number> {
    const data = (
      await request<{ pedidos?: unknown[] }>('/pedidos/semana', {
        method: 'POST',
        token: childToken,
        idempotencyKey,
        notifyOnUnauthorized: false,
        body: encodeWeekOrders(days),
      })
    ).data;
    return Array.isArray(data?.pedidos) ? data.pedidos.length : 0;
  },

  async cancelDependentOrder(childToken: string, order: Pick<OrderDetail, 'id' | 'version'>, idempotencyKey: string): Promise<void> {
    await request<unknown>(`/pedidos/${encodeURIComponent(order.id)}/cancelaciones`, {
      method: 'POST',
      token: childToken,
      idempotencyKey,
      notifyOnUnauthorized: false,
      body: { version_esperada: order.version, motivo: 'Cancelado por su tutor' },
    });
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
    input: { courtId: number; start: number | null; durationMinutes: number; players?: number | null },
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
        // Boliche: cuántos juegan (obligatorio ahí; 422 PLAYERS_REQUIRED sin él).
        ...(input.players ? { jugadores: input.players } : {}),
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
