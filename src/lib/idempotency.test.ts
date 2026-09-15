import { beforeEach, describe, expect, it } from 'vitest';
import {
  forgetIdempotencyKey,
  idempotencyKeyFor,
  orderFingerprint,
  readIdempotencyKey,
} from './idempotency';

describe('idempotency', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('reusa la misma clave para el mismo fingerprint', () => {
    const fingerprint = orderFingerprint({
      metodo_pago: 'efectivo',
      destino: 'para_llevar',
      espacio_id: null,
      notas_cocina: null,
      items: [{ producto_id: 1, cantidad: 1, opcion_ids: [] }],
    });
    const first = idempotencyKeyFor(fingerprint);
    expect(idempotencyKeyFor(fingerprint)).toBe(first);
    expect(readIdempotencyKey(fingerprint)).toBe(first);
    forgetIdempotencyKey(fingerprint);
    expect(readIdempotencyKey(fingerprint)).toBeUndefined();
  });
});
