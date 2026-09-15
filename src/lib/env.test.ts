import { describe, expect, it } from 'vitest';
import {
  developmentFirebaseConfig,
  productionFirebaseConfig,
  resolveApiUrl,
  resolveFirebaseConfig,
  walletQrUrl,
} from './env';

describe('env', () => {
  it('usa el proxy local en localhost y production en vaiinilla.app', () => {
    expect(resolveApiUrl(undefined, 'localhost')).toBe('/api/v1');
    expect(resolveApiUrl(undefined, '127.0.0.1')).toBe('/api/v1');
    expect(resolveApiUrl(undefined, 'vaiinilla.app')).toBe(
      'https://vaiinillaback.up.railway.app/api/v1',
    );
    expect(resolveApiUrl(undefined, 'www.vaiinilla.app')).toBe(
      'https://vaiinillaback.up.railway.app/api/v1',
    );
    expect(resolveApiUrl('https://example.test/api/v1/', 'vaiinilla.app')).toBe(
      'https://example.test/api/v1',
    );
  });

  it('fuerza API y Firebase de development en sand-user aunque Vercel inyecte prod', () => {
    expect(resolveApiUrl('https://vaiinillaback.up.railway.app/api/v1', 'sand-user.vaiinilla.app')).toBe(
      'https://vaiinillaback-development.up.railway.app/api/v1',
    );
    expect(resolveFirebaseConfig(
      {
        apiKey: 'from-env',
        authDomain: 'vaiinilla-produc.firebaseapp.com',
        projectId: 'vaiinilla-produc',
        appId: '1:1:web:prod',
      },
      'sand-user.vaiinilla.app',
    )).toEqual(developmentFirebaseConfig);
  });

  it('codifica el QR de recarga en el dominio público', () => {
    expect(walletQrUrl(' u-42 ')).toBe('https://vaiinilla.app/u/u-42');
  });

  it('usa Firebase de development en local y production en vaiinilla.app', () => {
    expect(resolveFirebaseConfig({}, 'localhost')).toEqual(developmentFirebaseConfig);
    expect(resolveFirebaseConfig({}, 'www.vaiinilla.app')).toEqual(productionFirebaseConfig);
    expect(
      resolveFirebaseConfig(
        {
          apiKey: 'from-env',
          authDomain: 'x.firebaseapp.com',
          projectId: 'x',
          appId: '1:1:web:x',
        },
        'www.vaiinilla.app',
      ).apiKey,
    ).toBe('from-env');
  });
});
