import { afterEach, describe, expect, it, vi } from 'vitest';
import { isFirebaseConfigReady, parseAppEnvironment, resolveApiUrl, resolveStaffAppUrl, verificationReturnUrl, walletQrUrl } from './env';

describe('env', () => {
  afterEach(() => vi.restoreAllMocks());
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

  it('continue_url sale de VITE_APP_URL por ambiente y nunca es el panel', () => {
    expect(verificationReturnUrl('https://sand-user.vaiinilla.app', 'http://localhost:5173')).toBe(
      'https://sand-user.vaiinilla.app/cuenta',
    );
    expect(verificationReturnUrl('https://vaiinilla.app', 'http://localhost:5173')).toBe('https://vaiinilla.app/cuenta');
    expect(verificationReturnUrl(undefined, 'https://vaiinilla.app')).not.toContain('dev.vaiinilla.app');
  });

  it('codifica el QR de recarga en el dominio público', () => {
    expect(walletQrUrl(' u-42 ', 'https://sand-user.test/', 'https://otro.test')).toBe('https://sand-user.test/u/u-42');
    expect(walletQrUrl('u-1', undefined, 'https://sand-user.test')).toBe('https://sand-user.test/u/u-1');
  });

  it.each([true, false])('limpia VITE_STAFF_APP_URL sin avisos (production=%s)', (isProd) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveStaffAppUrl(' https://panel.test/// ', isProd)).toBe('https://panel.test');
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([undefined, '', '  '])('usa el panel de producción si falta la URL (%s)', (url) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveStaffAppUrl(url, true)).toBe('https://app.vaiinilla.app');
    expect(error).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('VITE_STAFF_APP_URL'));
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([undefined, '', '  '])('usa el panel de desarrollo si falta la URL (%s)', (url) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveStaffAppUrl(url, false)).toBe('https://dev.vaiinilla.app');
    expect(warn).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('VITE_STAFF_APP_URL'));
    expect(error).not.toHaveBeenCalled();
  });
});
