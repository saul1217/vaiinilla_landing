import { describe, expect, it } from 'vitest';
import { emailProblem, passwordProblem } from './auth-validation';

describe('validaciones de cuenta en español', () => {
  it('pide el correo y explica cuando no parece válido', () => {
    expect(emailProblem('  ')).toBe('Escribe tu correo');
    expect(emailProblem('ana@')).toBe('Ese correo no parece válido');
    expect(emailProblem(' ana@example.test ')).toBeNull();
  });

  it('la contraseña pide al menos 8 caracteres', () => {
    expect(passwordProblem('1234567')).toBe('La contraseña debe tener al menos 8 caracteres');
    expect(passwordProblem('12345678')).toBeNull();
  });
});
