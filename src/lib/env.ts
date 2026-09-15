export const developmentApiUrl = 'https://vaiinillaback-development.up.railway.app/api/v1';
export const productionApiUrl = 'https://vaiinillaback.up.railway.app/api/v1';

export interface FirebaseClientConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

/** Public web client of `vaiinilla-b3a70`, same app as `dev.vaiinilla.app`. */
export const developmentFirebaseConfig: FirebaseClientConfig = {
  apiKey: 'AIzaSyBzMGLk27eskfBNCnO17201tCbcEEjfLds',
  authDomain: 'vaiinilla-b3a70.firebaseapp.com',
  projectId: 'vaiinilla-b3a70',
  storageBucket: 'vaiinilla-b3a70.firebasestorage.app',
  messagingSenderId: '697485438624',
  appId: '1:697485438624:web:c8a02c7cf99823f397a3c5',
};

/** Public web client of `vaiinilla-produc`, same app as `app.vaiinilla.app`. */
export const productionFirebaseConfig: FirebaseClientConfig = {
  apiKey: 'AIzaSyAlBwTPTqZjS7A1CGLqtGKupqNvO-8dyHs',
  authDomain: 'vaiinilla-produc.firebaseapp.com',
  projectId: 'vaiinilla-produc',
  storageBucket: 'vaiinilla-produc.firebasestorage.app',
  messagingSenderId: '1063589785442',
  appId: '1:1063589785442:web:fe98c2b66f95fb1055463b',
};

/** Public buyer sandbox; same Railway/Firebase development as localhost. */
export const buyerSandboxHostnames = ['sand-user.vaiinilla.app'] as const;

export function isLocalHostname(hostname: string): boolean {
  return hostname === '' || hostname === 'localhost' || hostname === '127.0.0.1';
}

export function isBuyerDevelopmentHostname(hostname: string): boolean {
  return (
    isLocalHostname(hostname) ||
    (buyerSandboxHostnames as readonly string[]).includes(hostname.toLowerCase())
  );
}

export function resolveApiUrl(
  envUrl: string | undefined,
  hostname: string,
): string {
  // Sandbox/local win over Vercel Production `VITE_API_URL`, otherwise a shared
  // www deploy would force sand-user onto the empty production API.
  if (isLocalHostname(hostname)) return '/api/v1';
  if (isBuyerDevelopmentHostname(hostname)) return developmentApiUrl;
  const explicit = envUrl?.replace(/\/$/, '');
  if (explicit) return explicit;
  return productionApiUrl;
}

export function isFirebaseConfigReady(config: FirebaseClientConfig): boolean {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

export function resolveFirebaseConfig(
  envConfig: FirebaseClientConfig,
  hostname: string,
): FirebaseClientConfig {
  if (isBuyerDevelopmentHostname(hostname)) return developmentFirebaseConfig;
  if (isFirebaseConfigReady(envConfig)) return envConfig;
  return productionFirebaseConfig;
}

export function walletQrUrl(userId: string): string {
  return `https://vaiinilla.app/u/${userId.trim()}`;
}
