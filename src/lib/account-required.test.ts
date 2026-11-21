import { describe, expect, it } from 'vitest';
import { accountRequired } from './account-required';

describe('accountRequired', () => {
  it('pide cuenta con matrícula o con cuenta_obligatoria', () => {
    expect(accountRequired({ identificador_cliente_obligatorio: true })).toBe(true);
    expect(accountRequired({ identificador_cliente_obligatorio: false, cuenta_obligatoria: true })).toBe(true);
  });

  it('sin ninguna de las dos, o con un back que no manda el campo, se pide sin cuenta', () => {
    expect(accountRequired({ identificador_cliente_obligatorio: false, cuenta_obligatoria: false })).toBe(false);
    expect(accountRequired({ identificador_cliente_obligatorio: false })).toBe(false);
    expect(accountRequired(null)).toBe(false);
  });
});
