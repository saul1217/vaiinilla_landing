import { describe, expect, it } from 'vitest';
import { isFirebaseConfigReady, parseAppEnvironment, resolveApiUrl, walletQrUrl } from './env';

describe('env', () => {
  it('toma el API de VITE_API_URL sin la diagonal final', () => {
    expect(resolveApiUrl('/api/v1')).toBe('/api/v1');
    expect(resolveApiUrl('https://example.test/api/v1/')).toBe('https://example.test/api/v1');
  });

  it('falla claro si falta VITE_API_URL', () => {
    expect(() => resolveApiUrl(undefined)).toThrow(/VITE_API_URL/);
    expect(() => resolveApiUrl('  ')).toThrow(/VITE_API_URL/);
  });

  it('VITE_APP_ENV solo es development si lo dice explícitamente', () => {
    expect(parseAppEnvironment('development')).toBe('development');
    expect(parseAppEnvironment('production')).toBe('production');
    expect(parseAppEnvironment(undefined)).toBe('production');
    expect(parseAppEnvironment('staging')).toBe('production');
  });

  it('Firebase necesita apiKey, authDomain, projectId y appId', () => {
    expect(isFirebaseConfigReady({})).toBe(false);
    expect(
      isFirebaseConfigReady({ apiKey: 'k', authDomain: 'x.firebaseapp.com', projectId: 'x', appId: '1:1:web:x' }),
    ).toBe(true);
  });

  it('codifica el QR de recarga en el dominio público', () => {
    expect(walletQrUrl(' u-42 ')).toBe('https://vaiinilla.app/u/u-42');
  });
});
