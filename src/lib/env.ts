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

export function isFirebaseConfigReady(config: FirebaseClientConfig): boolean {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

export function resolveFirebaseConfig(
  envConfig: FirebaseClientConfig,
  hostname: string,
): FirebaseClientConfig {
  if (isFirebaseConfigReady(envConfig)) return envConfig;
  const usesDevelopment =
    hostname === '' || hostname === 'localhost' || hostname === '127.0.0.1';
  return usesDevelopment ? developmentFirebaseConfig : productionFirebaseConfig;
}

export function walletQrUrl(userId: string): string {
  return `https://vaiinilla.app/u/${userId.trim()}`;
}
