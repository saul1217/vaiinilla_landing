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

export function walletQrUrl(userId: string): string {
  return `https://vaiinilla.app/u/${userId.trim()}`;
}
