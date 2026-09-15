export const developmentApiUrl = 'https://vaiinillaback-development.up.railway.app/api/v1';
export const productionApiUrl = 'https://vaiinillaback.up.railway.app/api/v1';

export function resolveApiUrl(
  envUrl: string | undefined,
  hostname: string,
): string {
  const explicit = envUrl?.replace(/\/$/, '');
  if (explicit) return explicit;
  const usesLocalFallback =
    hostname === '' || hostname === 'localhost' || hostname === '127.0.0.1';
  // Same-origin proxy in Vite avoids CORS during local/e2e. Production hosts
  // talk to Railway directly.
  return usesLocalFallback ? '/api/v1' : productionApiUrl;
}

export function walletQrUrl(userId: string): string {
  return `https://vaiinilla.app/u/${userId.trim()}`;
}
