import { describe, expect, it } from 'vitest';
import {
  assertStripeKeyMatchesApi,
  expectedStripeKeyMode,
  isSecretStripeMaterial,
  isStripeCheckoutEnabled,
  resolveStripePublishableKey,
  StripeKeyMismatchError,
} from './stripe-public';

const productionApiUrl = 'https://vaiinillaback.up.railway.app/api/v1';

describe('stripe public key resolver', () => {
  it('exige pk_test en development y pk_live en production', () => {
    expect(expectedStripeKeyMode('development')).toBe('test');
    expect(expectedStripeKeyMode('production')).toBe('live');

    expect(
      resolveStripePublishableKey({
        received: 'pk_test_51Vaiinilla',
        environment: 'development',
        apiUrl: '/api/v1',
      }),
    ).toBe('pk_test_51Vaiinilla');
    expect(
      resolveStripePublishableKey({
        received: 'pk_live_51Vaiinilla',
        environment: 'production',
        apiUrl: productionApiUrl,
      }),
    ).toBe('pk_live_51Vaiinilla');
  });

  it('usa VITE_APP_ENV si no se indica el ambiente', () => {
    // vite.config.ts fija VITE_APP_ENV=development para las pruebas.
    expect(resolveStripePublishableKey({ received: 'pk_test_51Vaiinilla' })).toBe('pk_test_51Vaiinilla');
    expect(isStripeCheckoutEnabled()).toBe(true);
  });

  it('falla si una clave live llega a development o una de test a production', () => {
    expect(() =>
      resolveStripePublishableKey({ received: 'pk_live_51Vaiinilla', environment: 'development' }),
    ).toThrow(StripeKeyMismatchError);
    expect(() =>
      resolveStripePublishableKey({ received: 'pk_test_51Vaiinilla', environment: 'production' }),
    ).toThrow(StripeKeyMismatchError);
    expect(() => assertStripeKeyMatchesApi('pk_live_51Vaiinilla', '/api/v1')).toThrow(
      /live contra la API de development/i,
    );
    expect(() => assertStripeKeyMatchesApi('pk_test_51Vaiinilla', productionApiUrl)).toThrow(
      /test contra la API de production/i,
    );
  });

  it('rechaza secretos sk_ y whsec_', () => {
    expect(isSecretStripeMaterial('sk_test_secret')).toBe(true);
    expect(isSecretStripeMaterial('whsec_secret')).toBe(true);
    expect(() =>
      resolveStripePublishableKey({ received: 'sk_test_secret', environment: 'development' }),
    ).toThrow(/no es pública/i);
  });
});
