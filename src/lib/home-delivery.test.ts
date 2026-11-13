import { describe, expect, it } from 'vitest';
import type { OperationalStatus } from '../types/api';
import { isHomeDeliveryEnabled } from './features';
import {
  EMPTY_HOME_ADDRESS,
  addressProblem,
  areaOf,
  effectiveHomePayment,
  homeCheckoutProblem,
  homeDeliveryFee,
  homeDeliveryOffer,
  homeDeliveryOrderFields,
  homePaymentMethod,
  homePayments,
  joinStreet,
  normalizeMoney,
  streetOf,
  totalWithFee,
  type HomeDeliveryOffer,
} from './home-delivery';

const base: OperationalStatus = {
  recibiendo_pedidos: true,
  sesion_caja_abierta: true,
  caja_en_linea: true,
  cocina_en_linea: true,
  tiempo_estimado_min: null,
  consultado_en: '2026-11-10T12:00:00Z',
};

const offer: HomeDeliveryOffer = {
  fee: '40.00',
  minimum: '200.00',
  radiusKm: '5',
  payOnArrival: true,
  depositPercent: 30,
  transferDetails: null,
};

const ready = { address: 'Aldama 1408, Centro, Chihuahua', reference: '', phone: '614 123 4567', lat: 28.63, lng: -106.08 };

describe('bandera de domicilio', () => {
  it('está apagada por defecto y solo se enciende con "true"', () => {
    expect(isHomeDeliveryEnabled(undefined)).toBe(false);
    expect(isHomeDeliveryEnabled('')).toBe(false);
    expect(isHomeDeliveryEnabled('false')).toBe(false);
    expect(isHomeDeliveryEnabled('1')).toBe(false);
    expect(isHomeDeliveryEnabled('true')).toBe(true);
  });

  it('en las pruebas (sin VITE_FEATURE_DOMICILIO) queda apagada', () => {
    expect(isHomeDeliveryEnabled()).toBe(false);
  });
});

describe('homeDeliveryOffer', () => {
  it('sin bloque `reparto` (negocio que no reparte o back viejo) no hay domicilio', () => {
    expect(homeDeliveryOffer(null)).toBeNull();
    expect(homeDeliveryOffer(base)).toBeNull();
    expect(homeDeliveryOffer({ ...base, reparto: { activo: false, radio_km: null, costo: '0.00', minimo: null } })).toBeNull();
  });

  it('lee costo, mínimo, radio, contra entrega y anticipo del estado operativo', () => {
    expect(
      homeDeliveryOffer({
        ...base,
        reparto: { activo: true, radio_km: '5', costo: '40', minimo: '200.00' },
        permite_contra_entrega: true,
        anticipo_porcentaje: 30,
        datos_transferencia: '  BBVA 0123  ',
      }),
    ).toEqual({ fee: '40.00', minimum: '200.00', radiusKm: '5', payOnArrival: true, depositPercent: 30, transferDetails: 'BBVA 0123' });
  });
});

describe('formas de pago a domicilio (orden de Android)', () => {
  it('tarjeta, anticipo y al recibir según lo que ofrece el negocio', () => {
    expect(homePayments(offer, true)).toEqual(['card', 'deposit', 'on_arrival']);
    expect(homePayments(offer, false)).toEqual(['on_arrival']);
    expect(homePayments({ ...offer, depositPercent: null, payOnArrival: false }, true)).toEqual(['card']);
    expect(homePayments({ ...offer, payOnArrival: false }, false)).toEqual([]);
  });

  it('si la elegida ya no se ofrece, usa la primera', () => {
    expect(effectiveHomePayment('deposit', ['on_arrival'])).toBe('on_arrival');
    expect(effectiveHomePayment(null, ['card', 'on_arrival'])).toBe('card');
    expect(effectiveHomePayment('card', [])).toBeNull();
    expect(homePaymentMethod('on_arrival')).toBe('efectivo');
    expect(homePaymentMethod('deposit')).toBe('stripe');
  });
});

describe('dirección', () => {
  it('reconoce la calle con número como Android (AddressStreet)', () => {
    expect(streetOf('Aldama 1408, Centro, 31000')).toBe('Aldama 1408');
    expect(streetOf('Roble s/n, Las Granjas')).toBe('Roble s/n');
    expect(streetOf('Centro, 31000, Chihuahua')).toBe('');
    expect(streetOf('Ubicación 28.63000, -106.08000')).toBe('');
    expect(areaOf('Ubicación 28.63000, -106.08000')).toEqual([]);
    expect(areaOf('Aldama 1408, Centro, 31000')).toEqual(['Centro', '31000']);
  });

  it('une la calle escrita con la colonia del mapa sin repetir', () => {
    expect(joinStreet('Aldama 1408', ['Centro', '31000'])).toBe('Aldama 1408, Centro, 31000');
    expect(joinStreet('', ['Centro'])).toBe('Centro');
  });

  it('pide calle con número y teléfono de 10 dígitos', () => {
    expect(addressProblem(EMPTY_HOME_ADDRESS)).toMatch(/calle, el número y la colonia/);
    expect(addressProblem({ ...ready, address: 'Centro, Chihuahua' })).toMatch(/calle y el número/);
    expect(addressProblem({ ...ready, phone: '12345' })).toMatch(/10 dígitos/);
    expect(addressProblem(ready)).toBeNull();
  });
});

describe('homeCheckoutProblem', () => {
  const quote = { llega: true, distancia_km: '2.1', costo: '45.00', minimo: '200.00' };
  const payments = ['card' as const];

  it('sin punto en el mapa o sin cotización pide elegir en el mapa', () => {
    expect(homeCheckoutProblem({ draft: { ...ready, lat: null, lng: null }, quote, offer, payments, subtotal: '300.00' })).toMatch(/mapa/);
    expect(homeCheckoutProblem({ draft: ready, quote: null, offer, payments, subtotal: '300.00' })).toMatch(/mapa/);
  });

  it('fuera de zona, debajo del mínimo o sin forma de cobro no deja pedir', () => {
    expect(homeCheckoutProblem({ draft: ready, quote: { ...quote, llega: false }, offer, payments, subtotal: '300.00' })).toMatch(/fuera de la zona/);
    expect(homeCheckoutProblem({ draft: ready, quote, offer, payments, subtotal: '199.99' })).toBe('El pedido mínimo a domicilio es de $200.');
    expect(homeCheckoutProblem({ draft: ready, quote, offer, payments: [], subtotal: '300.00' })).toMatch(/cómo cobrar/);
  });

  it('con todo listo no hay problema', () => {
    expect(homeCheckoutProblem({ draft: ready, quote, offer, payments, subtotal: '200.00' })).toBeNull();
  });
});

describe('envío y pedido', () => {
  it('el envío de la cotización manda sobre el fijo y se suma al total', () => {
    expect(homeDeliveryFee(offer, null)).toBe('40.00');
    expect(homeDeliveryFee(offer, { llega: true, distancia_km: null, costo: '55', minimo: null })).toBe('55.00');
    expect(totalWithFee('120.50', '40.00')).toBe('160.50');
    expect(totalWithFee(null, '40.00')).toBeNull();
    expect(normalizeMoney('abc')).toBeNull();
  });

  it('arma `entrega` con las claves que valida el back y solo la bandera de pago que aplica', () => {
    expect(homeDeliveryOrderFields({ ...ready, reference: ' Portón negro ' }, 'on_arrival')).toEqual({
      entrega: { direccion: 'Aldama 1408, Centro, Chihuahua', telefono: '6141234567', referencia: 'Portón negro', lat: 28.63, lng: -106.08 },
      al_recibir: true,
    });
    expect(homeDeliveryOrderFields(ready, 'deposit')).toEqual({
      entrega: { direccion: 'Aldama 1408, Centro, Chihuahua', telefono: '6141234567', lat: 28.63, lng: -106.08 },
      con_anticipo: true,
    });
    const card = homeDeliveryOrderFields({ ...ready, lat: null, lng: null }, 'card');
    expect(card).toEqual({ entrega: { direccion: 'Aldama 1408, Centro, Chihuahua', telefono: '6141234567' } });
  });
});
