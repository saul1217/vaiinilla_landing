// Configuración por ambiente. Todo sale de las variables VITE_* (ver .env.example):
// `npm run dev` usa .env.development y Vercel define Production y Preview. Aquí no
// hay URLs, claves ni dominios hardcodeados.

export type AppEnvironment = 'development' | 'production';

export interface FirebaseClientConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

/** Sin VITE_APP_ENV se asume production: es el lado seguro (exige pk_live_). */
export function parseAppEnvironment(value: string | undefined): AppEnvironment {
  return value?.trim() === 'development' ? 'development' : 'production';
}

export const appEnvironment: AppEnvironment = parseAppEnvironment(import.meta.env.VITE_APP_ENV);

export function resolveApiUrl(envUrl: string | undefined): string {
  const url = envUrl?.trim().replace(/\/$/, '');
  if (!url) {
    throw new Error('Falta VITE_API_URL: configúrala en .env.development o en Vercel.');
  }
  return url;
}

export function isFirebaseConfigReady(config: FirebaseClientConfig): boolean {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

/**
 * Landing a la que regresa el enlace del correo de verificación: VITE_APP_URL si el ambiente la
 * define; si no, el origen desde el que se abrió la landing (develop → sand-user, prod → vaiinilla.app).
 */
/** La landing solo existe en español (<html lang="es">): el correo de verificación va en ese idioma. */
export const VERIFICATION_EMAIL_LANGUAGE = 'es';

export function verificationReturnUrl(
  envUrl: string | undefined = import.meta.env.VITE_APP_URL,
  origin: string = window.location.origin,
): string {
  return `${publicBaseUrl(envUrl, origin)}/cuenta`;
}

/** Landing pública del ambiente: VITE_APP_URL o el origen actual, sin diagonal final. */
export function publicBaseUrl(
  envUrl: string | undefined = import.meta.env.VITE_APP_URL,
  origin: string = window.location.origin,
): string {
  return (envUrl?.trim() || origin).replace(/\/$/, '');
}

/** Panel del equipo del ambiente (VITE_STAFF_APP_URL): develop no debe apuntar al de producción. */
export function resolveStaffAppUrl(envUrl: string | undefined): string {
  const url = envUrl?.trim().replace(/\/$/, '');
  if (!url) {
    throw new Error('Falta VITE_STAFF_APP_URL: configúrala en .env.development o en Vercel.');
  }
  return url;
}

export function walletQrUrl(
  userId: string,
  envUrl: string | undefined = import.meta.env.VITE_APP_URL,
  origin: string = window.location.origin,
): string {
  return `${publicBaseUrl(envUrl, origin)}/u/${userId.trim()}`;
}
