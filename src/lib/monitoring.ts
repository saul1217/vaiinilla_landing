import * as Sentry from '@sentry/react';

// Monitoreo opcional de errores (Sentry). Solo se activa si VITE_SENTRY_DSN existe en el build.
// Vercel: VITE_SENTRY_DSN (DSN del proyecto Sentry de cada ambiente) y VITE_APP_ENV
// (production | development). Sin DSN no se inicializa nada. Sin PII: no se activa sendDefaultPii.
export function initMonitoring(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_APP_ENV ?? 'development',
    tracesSampleRate: 0,
  });
}
