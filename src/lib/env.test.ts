import { describe, expect, it } from 'vitest';
import { resolveApiUrl, walletQrUrl } from './env';

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

  it('codifica el QR de recarga en el dominio público', () => {
    expect(walletQrUrl(' u-42 ')).toBe('https://vaiinilla.app/u/u-42');
  });
});
