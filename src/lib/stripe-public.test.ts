import { describe, expect, it } from 'vitest';
import {
  developmentApiUrl,
  developmentFirebaseConfig,
  productionApiUrl,
  productionFirebaseConfig,
  resolveApiUrl,
  resolveFirebaseConfig,
} from './env';
import {
  assertStripeKeyMatchesApi,
  expectedStripeKeyMode,
  isSecretStripeMaterial,
  resolveStripePublishableKey,
  StripeKeyMismatchError,
} from './stripe-public';

describe('stripe public key resolver', () => {
  it('exige pk_test en development y pk_live en production', () => {
    expect(expectedStripeKeyMode('localhost')).toBe('test');
    expect(expectedStripeKeyMode('127.0.0.1')).toBe('test');
    expect(expectedStripeKeyMode('sand-user.vaiinilla.app')).toBe('test');
    expect(expectedStripeKeyMode('vaiinilla.app')).toBe('live');
    expect(expectedStripeKeyMode('www.vaiinilla.app')).toBe('live');

    expect(
      resolveStripePublishableKey({
        received: 'pk_test_51Vaiinilla',
        hostname: 'localhost',
        apiUrl: '/api/v1',
      }),
    ).toBe('pk_test_51Vaiinilla');
    expect(
      resolveStripePublishableKey({
        received: 'pk_live_51Vaiinilla',
        hostname: 'vaiinilla.app',
        apiUrl: productionApiUrl,
      }),
    ).toBe('pk_live_51Vaiinilla');
  });

  it('falla si una clave live llega a localhost o una de test a vaiinilla.app', () => {
    expect(() =>
      resolveStripePublishableKey({ received: 'pk_live_51Vaiinilla', hostname: 'localhost' }),
    ).toThrow(StripeKeyMismatchError);
    expect(() =>
      resolveStripePublishableKey({ received: 'pk_test_51Vaiinilla', hostname: 'vaiinilla.app' }),
    ).toThrow(StripeKeyMismatchError);
    expect(() =>
      assertStripeKeyMatchesApi('pk_live_51Vaiinilla', '/api/v1'),
    ).toThrow(/live contra la API de development/i);
    expect(() =>
      assertStripeKeyMatchesApi('pk_test_51Vaiinilla', productionApiUrl),
    ).toThrow(/test contra la API de production/i);
  });

  it('rechaza secretos sk_ y whsec_', () => {
    expect(isSecretStripeMaterial('sk_test_secret')).toBe(true);
    expect(isSecretStripeMaterial('whsec_secret')).toBe(true);
    expect(() =>
      resolveStripePublishableKey({ received: 'sk_test_secret', hostname: 'localhost' }),
    ).toThrow(/no es pública/i);
  });
});

describe('hostname runtime alignment', () => {
  it('alinea API, Stripe y Firebase de development en localhost y sand-user', () => {
    for (const host of ['localhost', '127.0.0.1', 'sand-user.vaiinilla.app']) {
      expect(expectedStripeKeyMode(host)).toBe('test');
      expect(resolveFirebaseConfig({}, host)).toEqual(developmentFirebaseConfig);
      expect(resolveFirebaseConfig({}, host).projectId).toBe('vaiinilla-b3a70');
    }
    expect(resolveApiUrl(undefined, 'localhost')).toBe('/api/v1');
    expect(resolveApiUrl(productionApiUrl, 'sand-user.vaiinilla.app')).toBe(developmentApiUrl);
  });

  it('alinea API, Stripe y Firebase de production en vaiinilla.app y www', () => {
    for (const host of ['vaiinilla.app', 'www.vaiinilla.app']) {
      expect(expectedStripeKeyMode(host)).toBe('live');
      expect(resolveApiUrl(undefined, host)).toBe(productionApiUrl);
      expect(resolveFirebaseConfig({}, host)).toEqual(productionFirebaseConfig);
      expect(resolveFirebaseConfig({}, host).projectId).toBe('vaiinilla-produc');
    }
  });
});
