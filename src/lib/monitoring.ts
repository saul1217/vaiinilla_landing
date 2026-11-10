import * as Sentry from '@sentry/react';

// Monitoreo opcional de errores (Sentry). Solo se activa si VITE_SENTRY_DSN existe en el build.
// Vercel: VITE_SENTRY_DSN (DSN del proyecto Sentry de cada ambiente) y VITE_APP_ENV
// (production | development). Sin DSN no se inicializa nada.
//
// beforeSend y beforeBreadcrumb quitan lo sensible antes de que salga del navegador. Son las mismas
// reglas de vaiinilla-web (src/app/sentry.ts, PR #146 y #148) más lo propio de la landing: el token
// del hijo en modo papás, los tokens de mesa y de seguimiento en la ruta, el oobCode de Firebase y el
// client_secret de Stripe. Todas las expresiones regulares son fijas (sin RegExp con texto variable).

export const FILTERED = '[Filtered]';
const EMAIL_MARK = '[email]';
const PHONE_MARK = '[telefono]';
const MAX_DEPTH = 12;

/**
 * Claves cuyo valor siempre se oculta. Se comparan en minúsculas y sin `_` ni `-`, así que
 * `access_token`, `accessToken` y `Access-Token` cuentan igual. Además, cualquier clave que lleve
 * `token` en el nombre (qr_token, child_token, token_hijo, deviceToken...) también se oculta: ver isSensitiveKey.
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'secret',
  'clientsecret',
  'cookie',
  'setcookie',
  'authorization',
  'oobcode',
  'apikey',
]);

/** Claves con datos personales: su valor se oculta en cualquier nivel. */
const PERSONAL_KEYS = new Set([
  'email',
  'correo',
  'telefono',
  'phone',
  'phonenumber',
  'celular',
  'direccion',
  'address',
  'ipaddress',
  'fechanacimiento',
  'birthdate',
  'curp',
  'rfc',
  'nombrecompleto',
  'fullname',
  'displayname',
  'firstname',
  'lastname',
  'apellido',
  'apellidos',
]);

/** Parámetros de URL que se tapan (tokens, códigos de un solo uso, secretos de Stripe y correos). */
const SENSITIVE_PARAMS =
  /([?&#;](?:token|access_token|id_token|refresh_token|child_token|token_hijo|qr_token|nuevo|apiKey|key|email|code|oobCode|client_secret|payment_intent_client_secret|setup_intent_client_secret)=)[^&#\s"']*/gi;
/** `?q=` de búsquedas: se tapa hasta el siguiente `&` o `#` (o comilla o salto de línea). */
const SEARCH_PARAM = /([?&#;]q=)[^&#"'\r\n]*/gi;
/** Tokens en la ruta: QR de mesa (`/m/<token>`), seguimiento de pedido y el id de usuario del QR de saldo. */
const PATH_TOKENS = /(\/(?:m|seguimiento|u)\/)[^/?#\s"']+/gi;
const EMAIL = /[^\s@"'<>/?&=]+@[^\s@"'<>]+\.[^\s@"'<>]+/g;
/** Teléfonos de 10 dígitos (México), con lada internacional opcional (+52) y espacios o guiones. */
const PHONE = /(?<![\w.+])(?:\+\d{1,3}[ -]?)?(?:\d[ -]?){9}\d(?![\w.])/g;
/** JWT dentro de un texto: el encabezado en base64url de `{"` siempre empieza con eyJ. */
const JWT_IN_TEXT = /eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g;
/** Valor completo con forma de JWT aunque no empiece con eyJ (segmentos largos para no tocar dominios ni versiones). */
const JWT_WHOLE = /^[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/;
/** Token de dispositivo VILLO dentro de un texto: 'villo_' + 43 caracteres base64url. */
const VILLO_IN_TEXT = /villo_[A-Za-z0-9_-]{43}/g;
/** `Authorization: Bearer <lo que sea>` o `Bearer <lo que sea>` dentro de un texto. */
const BEARER_IN_TEXT = /(\bBearer\s+)[^\s"',;]+/gi;
/** `"token": "..."`, `"password": "..."` y similares dentro de un texto que no es JSON completo. */
const SENSITIVE_IN_JSON_TEXT =
  /("(?:[A-Za-z_-]*token[A-Za-z_-]*|password|secret|client_secret|cookie|authorization|oobCode|email|correo|telefono|phone)"\s*:\s*")(?:[^"\\]|\\.)*"/gi;

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[_-]/g, '');
}

function isSensitiveKey(key: string): boolean {
  const k = normalizeKey(key);
  return k.includes('token') || SENSITIVE_KEYS.has(k) || PERSONAL_KEYS.has(k);
}

/** Quita tokens de parámetros y de la ruta, `?q=`, correos y teléfonos de una URL o texto. */
export function scrubUrl(value: string): string {
  return value
    .replace(SENSITIVE_PARAMS, `$1${FILTERED}`)
    .replace(SEARCH_PARAM, `$1${FILTERED}`)
    .replace(PATH_TOKENS, `$1${FILTERED}`)
    .replace(EMAIL, EMAIL_MARK)
    .replace(PHONE, PHONE_MARK);
}

/** Redacta un texto suelto: JWT, `villo_`, Bearer, claves sensibles en JSON incrustado, URLs, correos y teléfonos. */
export function redactString(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('villo_') || JWT_WHOLE.test(trimmed)) return FILTERED;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') return JSON.stringify(redactDeep(parsed));
    } catch {
      // No es JSON válido: se limpia como texto.
    }
  }
  return scrubUrl(
    value
      .replace(JWT_IN_TEXT, FILTERED)
      .replace(VILLO_IN_TEXT, FILTERED)
      .replace(BEARER_IN_TEXT, `$1${FILTERED}`)
      .replace(SENSITIVE_IN_JSON_TEXT, `$1${FILTERED}"`),
  );
}

/**
 * Recorre objetos y arreglos anidados (y JSON en texto) y cambia por "[Filtered]" los valores de claves
 * sensibles o personales y cualquier texto con forma de token. Modifica en el lugar y conserva lo demás.
 */
export function redactDeep<T>(value: T, depth = 0, seen: WeakSet<object> = new WeakSet()): T {
  if (typeof value === 'string') return redactString(value) as T;
  if (!value || typeof value !== 'object' || depth > MAX_DEPTH || seen.has(value)) return value;
  seen.add(value);
  if (Array.isArray(value)) {
    const list = value as unknown[];
    for (let i = 0; i < list.length; i++) list[i] = redactDeep(list[i], depth + 1, seen);
    return value;
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const v = record[key];
    if (isSensitiveKey(key) && v !== null && v !== undefined && v !== '') record[key] = FILTERED;
    else record[key] = redactDeep(v, depth + 1, seen);
  }
  return value;
}

/** Valor de un parámetro de query: se oculta si la clave es sensible; si no, se limpia como texto. */
function redactQueryValue(key: string, value: unknown): unknown {
  let name = key;
  try {
    name = decodeURIComponent(key);
  } catch {
    // Clave mal codificada: se compara tal cual.
  }
  if (value === null || value === undefined || value === '') return value;
  // scrubUrl decide con las mismas reglas de las URLs (nuevo, key, code, client_secret, q...).
  const asParam = `?${name.trim()}=x`;
  if (isSensitiveKey(name.trim()) || scrubUrl(asParam) !== asParam) return FILTERED;
  return typeof value === 'string' ? redactString(value) : redactDeep(value);
}

type QueryParams = NonNullable<NonNullable<Sentry.ErrorEvent['request']>['query_string']>;

/** Redacta `query_string` en sus tres formas: cadena `a=1&b=2`, objeto `{a: '1'}` o lista de pares `[['a', '1']]`. */
export function redactQueryString(query: QueryParams): QueryParams {
  if (typeof query === 'string') {
    const hasMark = query.startsWith('?');
    const body = hasMark ? query.slice(1) : query;
    const out = body
      .split('&')
      .map((pair) => {
        const eq = pair.indexOf('=');
        if (eq === -1) return redactString(pair);
        const key = pair.slice(0, eq);
        return `${key}=${String(redactQueryValue(key, pair.slice(eq + 1)))}`;
      })
      .join('&');
    return hasMark ? `?${out}` : out;
  }
  if (Array.isArray(query)) {
    return query.map((pair) => {
      if (!Array.isArray(pair) || pair.length < 2) return redactDeep(pair);
      const [key, value] = pair;
      return [key, redactQueryValue(String(key), value)];
    }) as QueryParams;
  }
  if (query && typeof query === 'object') {
    const record = query as Record<string, unknown>;
    for (const key of Object.keys(record)) record[key] = redactQueryValue(key, record[key]);
  }
  return query;
}

/** Quita Authorization, cookies y cualquier header con "token" en el nombre; limpia el resto como texto. */
function scrubHeaders(headers: Record<string, string> | undefined): void {
  if (!headers) return;
  for (const name of Object.keys(headers)) {
    if (/^(?:authorization|proxy-authorization|cookie|set-cookie|x-.*token.*|x-api-key)$/i.test(name)) {
      delete headers[name];
    } else {
      headers[name] = redactString(headers[name] ?? '');
    }
  }
}

export function beforeSend(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.request) {
    if (event.request.url) event.request.url = redactString(event.request.url);
    if (event.request.query_string) event.request.query_string = redactQueryString(event.request.query_string);
    delete event.request.cookies;
    // El cuerpo de la petición puede traer contraseñas o datos personales que no son tokens: no se envía.
    delete event.request.data;
    scrubHeaders(event.request.headers);
  }
  // Usuario: correo, IP, nombre e id no salen.
  delete event.user;
  if (event.transaction) event.transaction = redactString(event.transaction);
  if (event.message) event.message = redactString(event.message);
  if (event.logentry?.message) event.logentry.message = redactString(event.logentry.message);
  if (event.logentry?.params) redactDeep(event.logentry.params);
  event.exception?.values?.forEach((ex) => {
    if (ex.value) ex.value = redactString(ex.value);
  });
  redactDeep(event.extra);
  redactDeep(event.contexts);
  redactDeep(event.tags);
  event.breadcrumbs?.forEach((b) => {
    if (b.message) b.message = redactString(b.message);
    redactDeep(b.data);
  });
  return event;
}

export function beforeBreadcrumb(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb | null {
  if (breadcrumb.message) breadcrumb.message = redactString(breadcrumb.message);
  redactDeep(breadcrumb.data);
  return breadcrumb;
}

export function initMonitoring(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_APP_ENV ?? 'development',
    tracesSampleRate: 0,
    beforeSend,
    beforeBreadcrumb,
  });
}
