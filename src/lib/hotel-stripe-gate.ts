import { appEnvironment, type AppEnvironment } from './env';
import { isProductionApiUrl, isSecretStripeMaterial, stripeKeyMode, stripePublishableKey } from './stripe-public';
import type { OrderDetail } from '../types/api';

/*
 * Compuerta de Stripe del flujo del huésped de hotel: mientras el hotel está en prueba, la
 * tarjeta solo se ofrece en modo prueba de Stripe. Se bloquea si la landing es la de
 * producción, si la API es la de producción o si la clave pública no es pk_test_. Con
 * cualquiera de esas, el huésped solo puede cargar a la habitación y no se crea ningún pago live.
 */

export type HotelCardBlock = 'environment' | 'api' | 'key';

export const HOTEL_CARD_TEST_ONLY_COPY =
  'El pago con tarjeta del hotel solo funciona en modo de prueba. No se hizo ningún cobro.';

export interface HotelCardGateInput {
  environment?: AppEnvironment;
  envKey?: string | null;
  apiUrl?: string | null;
}

/** Por qué no se ofrece la tarjeta en el hotel; null si se puede (solo modo prueba). */
export function hotelCardBlock({
  environment = appEnvironment,
  envKey = stripePublishableKey(),
  apiUrl = import.meta.env.VITE_API_URL,
}: HotelCardGateInput = {}): HotelCardBlock | null {
  if (environment !== 'development') return 'environment';
  if (apiUrl && isProductionApiUrl(apiUrl)) return 'api';
  const key = envKey?.trim();
  if (key && (isSecretStripeMaterial(key) || stripeKeyMode(key) !== 'test')) return 'key';
  return null;
}

export function isHotelCardTestModeAllowed(input?: HotelCardGateInput): boolean {
  return hotelCardBlock(input) === null;
}

/**
 * Segunda revisión con la respuesta del servidor: si el pedido con tarjeta trae una clave
 * pública que no es pk_test_, no se abre el pago.
 */
export function isLiveStripeOrder(order: Pick<OrderDetail, 'pago'>): boolean {
  const key = order.pago?.publishable_key?.trim();
  return Boolean(key) && stripeKeyMode(key!) !== 'test';
}
