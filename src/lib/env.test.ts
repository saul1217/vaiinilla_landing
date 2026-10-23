import { describe, expect, it } from 'vitest';
import { isFirebaseConfigReady, parseAppEnvironment, resolveApiUrl, resolveStaffAppUrl, verificationReturnUrl, walletQrUrl } from './env';

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

  it('el enlace de verificación regresa a la landing del ambiente, sin URLs fijas', () => {
    expect(verificationReturnUrl(undefined, 'https://sand-user.vaiinilla.app')).toBe(
      'https://sand-user.vaiinilla.app/cuenta',
    );
    expect(verificationReturnUrl('https://vaiinilla.app/', 'https://otro.test')).toBe('https://vaiinilla.app/cuenta');
    expect(verificationReturnUrl('  ', 'https://vaiinilla.app')).toBe('https://vaiinilla.app/cuenta');
  });

  it('codifica el QR de recarga en el dominio público', () => {
    expect(walletQrUrl(' u-42 ', 'https://sand-user.test/', 'https://otro.test')).toBe('https://sand-user.test/u/u-42');
    expect(walletQrUrl('u-1', undefined, 'https://sand-user.test')).toBe('https://sand-user.test/u/u-1');
  });

  it('el panel del equipo sale de VITE_STAFF_APP_URL y falla si falta', () => {
    expect(resolveStaffAppUrl(' https://panel.test/ ')).toBe('https://panel.test');
    expect(() => resolveStaffAppUrl(undefined)).toThrow(/VITE_STAFF_APP_URL/);
  });
});
