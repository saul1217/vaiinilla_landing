import { isBuyerDevelopmentHostname } from './env';

export type StripeKeyMode = 'test' | 'live';

export const STRIPE_UNAVAILABLE_COPY = 'Pago con tarjeta no disponible por ahora.';

export class StripeKeyMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StripeKeyMismatchError';
  }
}

export function stripePublishableKey(): string | undefined {
  const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim();
  return key ? key : undefined;
}

export function expectedStripeKeyMode(hostname: string): StripeKeyMode {
  return isBuyerDevelopmentHostname(hostname) ? 'test' : 'live';
}

export function stripeKeyMode(key: string): StripeKeyMode | null {
  if (key.startsWith('pk_test_')) return 'test';
  if (key.startsWith('pk_live_')) return 'live';
  return null;
}

export function isSecretStripeMaterial(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith('sk_') || trimmed.startsWith('whsec_') || trimmed.startsWith('rk_');
}

export function isDevelopmentApiUrl(apiUrl: string): boolean {
  return apiUrl === '/api/v1' || apiUrl.includes('vaiinillaback-development.up.railway.app');
}

export function isProductionApiUrl(apiUrl: string): boolean {
  return (
    apiUrl.includes('vaiinillaback.up.railway.app') && !apiUrl.includes('vaiinillaback-development')
  );
}

export function assertStripeKeyMatchesApi(key: string, apiUrl: string): void {
  const mode = stripeKeyMode(key);
  if (isDevelopmentApiUrl(apiUrl) && mode !== 'test') {
    throw new StripeKeyMismatchError('No se puede usar una clave live contra la API de development.');
  }
  if (isProductionApiUrl(apiUrl) && mode !== 'live') {
    throw new StripeKeyMismatchError('No se puede usar una clave de test contra la API de production.');
  }
}

export function resolveStripePublishableKey(options: {
  received?: string | null;
  envKey?: string | null;
  hostname: string;
  apiUrl?: string;
}): string {
  const received = options.received?.trim() ?? '';
  const envKey = options.envKey?.trim() ?? '';
  const key = received || envKey;
  if (!key) {
    throw new StripeKeyMismatchError('Falta la clave pública de Stripe para este pedido.');
  }
  if (isSecretStripeMaterial(key)) {
    throw new StripeKeyMismatchError('La clave de Stripe no es pública.');
  }
  const mode = stripeKeyMode(key);
  const expected = expectedStripeKeyMode(options.hostname);
  if (mode !== expected) {
    throw new StripeKeyMismatchError(
      expected === 'test'
        ? 'Este entorno de development solo admite claves pk_test_.'
        : 'Este entorno de producción solo admite claves pk_live_.',
    );
  }
  if (options.apiUrl) assertStripeKeyMatchesApi(key, options.apiUrl);
  return key;
}

export function isStripeCheckoutEnabled(
  hostname = typeof window === 'undefined' ? '' : window.location.hostname,
): boolean {
  const envKey = stripePublishableKey();
  if (!envKey) return true;
  if (isSecretStripeMaterial(envKey)) return false;
  return stripeKeyMode(envKey) === expectedStripeKeyMode(hostname);
}
