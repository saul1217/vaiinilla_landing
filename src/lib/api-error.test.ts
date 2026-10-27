import { describe, expect, it } from 'vitest';
import { firebaseAuthMessage } from './api-error';

function firebaseError(code: string) {
  return Object.assign(new Error(`Firebase: Error (${code}).`), { code });
}

describe('firebaseAuthMessage (QA-053)', () => {
  it.each([
    ['auth/email-already-in-use', /ya tiene una cuenta/i],
    ['auth/invalid-email', /formato válido/i],
    ['auth/weak-password', /muy débil/i],
    ['auth/too-many-requests', /demasiados intentos/i],
    ['auth/network-request-failed', /conexión/i],
    ['auth/invalid-credential', /no son correctos/i],
    ['auth/user-disabled', /deshabilitada/i],
  ])('%s se explica en español', (code, expected) => {
    expect(firebaseAuthMessage(firebaseError(code))).toMatch(expected);
  });

  it('un bloqueo de referer o dominio de la API key se distingue del genérico', () => {
    const code = 'auth/requests-from-referer-https://x.vercel.app/-are-blocked';
    expect(firebaseAuthMessage(firebaseError(code))).toMatch(/no está autorizado/i);
    expect(firebaseAuthMessage(firebaseError('auth/unauthorized-domain'))).toMatch(/no está autorizado/i);
  });

  it('un código desconocido cae en un mensaje genérico, sin texto crudo', () => {
    const message = firebaseAuthMessage(firebaseError('auth/algo-nuevo'));
    expect(message).toBe('No pudimos completar el acceso. Inténtalo de nuevo.');
    expect(message).not.toMatch(/firebase|auth\//i);
  });

  it('un error sin código pero con texto del SDK tampoco se muestra crudo', () => {
    expect(firebaseAuthMessage(new Error('Firebase: Error (auth/foo).'))).not.toMatch(/firebase/i);
  });

  it('otros errores conservan su mensaje', () => {
    expect(firebaseAuthMessage(new Error('Acepta los términos.'))).toBe('Acepta los términos.');
    expect(firebaseAuthMessage('x')).toMatch(/error inesperado/i);
  });
});
