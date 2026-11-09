import { describe, expect, it } from 'vitest';
import { hotelCardBlock, isHotelCardTestModeAllowed, isLiveStripeOrder } from './hotel-stripe-gate';
import type { OrderDetail } from '../types/api';

const DEV_API = 'https://vaiinillaback-development.up.railway.app/api/v1';
const PROD_API = 'https://vaiinillaback.up.railway.app/api/v1';

describe('compuerta de Stripe del hotel (solo modo prueba)', () => {
  it('permite la tarjeta en development con pk_test_ y la API de development', () => {
    expect(hotelCardBlock({ environment: 'development', envKey: 'pk_test_abc', apiUrl: DEV_API })).toBeNull();
    expect(isHotelCardTestModeAllowed({ environment: 'development', envKey: 'pk_test_abc', apiUrl: '/api/v1' })).toBe(true);
  });

  it('sin clave en la web (la manda el servidor) se permite solo en development', () => {
    expect(hotelCardBlock({ environment: 'development', envKey: null, apiUrl: DEV_API })).toBeNull();
    expect(hotelCardBlock({ environment: 'production', envKey: null, apiUrl: DEV_API })).toBe('environment');
  });

  it('bloquea la landing de producción aunque la clave sea de prueba', () => {
    expect(hotelCardBlock({ environment: 'production', envKey: 'pk_test_abc', apiUrl: DEV_API })).toBe('environment');
  });

  it('bloquea la API de producción', () => {
    expect(hotelCardBlock({ environment: 'development', envKey: 'pk_test_abc', apiUrl: PROD_API })).toBe('api');
  });

  it('bloquea claves live, secretas o desconocidas', () => {
    for (const envKey of ['pk_live_abc', 'sk_test_abc', 'rk_live_abc', 'whsec_abc', 'otra']) {
      expect(hotelCardBlock({ environment: 'development', envKey, apiUrl: DEV_API })).toBe('key');
    }
  });

  it('detecta un pedido con clave live del servidor', () => {
    const order = (key?: string) => ({ pago: key ? { publishable_key: key } : null }) as unknown as OrderDetail;
    expect(isLiveStripeOrder(order('pk_live_abc'))).toBe(true);
    expect(isLiveStripeOrder(order('pk_test_abc'))).toBe(false);
    expect(isLiveStripeOrder(order())).toBe(false);
  });
});
