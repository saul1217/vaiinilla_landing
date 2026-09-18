import { describe, expect, it } from 'vitest';
import { cartPreview, centsToMoney, formatAmount, isValidMoney, linePreview, productUnitPreview } from './money';

describe('money', () => {
  it('acepta el formato contractual', () => {
    expect(isValidMoney('0.00')).toBe(true);
    expect(isValidMoney('82.00')).toBe(true);
    expect(isValidMoney('08.00')).toBe(false);
    expect(isValidMoney('1.2')).toBe(false);
  });

  it('calcula vista previa de unidad y línea como Android', () => {
    expect(productUnitPreview('70.00', ['7.00', '5.00', '0.00'])).toBe('82.00');
    expect(linePreview('82.00', 2)).toBe('164.00');
    expect(cartPreview(['164.00', '20.00'])).toBe('184.00');
    expect(centsToMoney(-3500n)).toBe('-35.00');
  });

  it('formatea montos compactos como Android', () => {
    expect(formatAmount('22.00')).toBe('$22');
    expect(formatAmount('73.70')).toBe('$73.70');
    expect(formatAmount('0.00', 'always')).toBe('$0.00');
  });
});
