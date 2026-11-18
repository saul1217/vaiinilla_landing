import { describe, expect, it } from 'vitest';
import { VaiinillaApiError } from './api-error';
import {
  cardBelowMinimum,
  cardFromLabel,
  cardMinimumErrorMessage,
  cardMinimumMessage,
  cardMinimumNotice,
} from './card-minimum';

describe('mínimo por cobro con tarjeta', () => {
  it('es estricto y en centavos: $30.00 no pasa y $30.01 sí', () => {
    expect(cardBelowMinimum('30.00', '30.00')).toBe(true);
    expect(cardBelowMinimum('29.99', '30.00')).toBe(true);
    expect(cardBelowMinimum('30.01', '30.00')).toBe(false);
    expect(cardBelowMinimum('0.30', '0.29')).toBe(false);
  });

  it('sin mínimo (null o ausente) o con datos ilegibles no bloquea', () => {
    expect(cardBelowMinimum('5.00', null)).toBe(false);
    expect(cardBelowMinimum('5.00', undefined)).toBe(false);
    expect(cardBelowMinimum(null, '30.00')).toBe(false);
    expect(cardBelowMinimum('5', '30.00')).toBe(false);
    expect(cardBelowMinimum('5.00', 'treinta')).toBe(false);
  });

  it('dice desde cuánto acepta tarjeta', () => {
    expect(cardFromLabel('30.00')).toBe('$30.01');
    expect(cardFromLabel('49.99')).toBe('$50.00');
    expect(cardMinimumNotice('30.00')).toBe('Tarjeta desde $30.01: el cobro debe ser mayor a $30.00 MXN.');
    expect(cardMinimumMessage('30.00', false)).toBe(
      'El cobro con tarjeta debe ser mayor a $30.00 MXN (tarjeta desde $30.01). Agrega productos para continuar.',
    );
  });

  it('traduce el 422 CARD_MIN_AMOUNT por código y details.minimo', () => {
    const conCaja = new VaiinillaApiError(422, {
      code: 'CARD_MIN_AMOUNT',
      message: 'texto del servidor',
      details: [{ minimo: '30.00', monto: '25.00', efectivo_disponible: true }],
    });
    expect(cardMinimumErrorMessage(conCaja)).toBe(
      'El cobro con tarjeta debe ser mayor a $30.00 MXN (tarjeta desde $30.01). Elige pago en caja o agrega productos.',
    );
    const sinCaja = new VaiinillaApiError(422, {
      code: 'CARD_MIN_AMOUNT',
      message: 'texto del servidor',
      details: { minimo: '30.00', efectivo_disponible: false },
    });
    expect(cardMinimumErrorMessage(sinCaja)).toMatch(/Agrega productos para continuar\.$/);
    const sinDetalles = new VaiinillaApiError(422, { code: 'CARD_MIN_AMOUNT', message: 'texto del servidor' });
    expect(cardMinimumErrorMessage(sinDetalles)).toBe('texto del servidor');
  });

  it('no toca otros errores', () => {
    expect(cardMinimumErrorMessage(new VaiinillaApiError(422, { code: 'VALIDATION_ERROR', message: 'x' }))).toBeNull();
    expect(cardMinimumErrorMessage(new Error('red'))).toBeNull();
  });
});
