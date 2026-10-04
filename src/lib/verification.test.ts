import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearVerificationSent,
  markVerificationSent,
  verificationWasSent,
} from './verification';

describe('aviso de verificación enviada', () => {
  beforeEach(() => sessionStorage.clear());

  it('solo existe cuando el envío se disparó de verdad', () => {
    expect(verificationWasSent()).toBe(false);
    markVerificationSent();
    expect(verificationWasSent()).toBe(true);
    clearVerificationSent();
    expect(verificationWasSent()).toBe(false);
  });
});
