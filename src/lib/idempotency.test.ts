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

describe('orderFingerprint con domicilio y encargos', () => {
  const base = {
    metodo_pago: 'efectivo',
    destino: 'para_llevar',
    espacio_id: null,
    notas_cocina: null,
    items: [{ producto_id: 1, cantidad: 2, opcion_ids: [3, 1] }],
  };
  const home = {
    ...base,
    destino: 'a_domicilio',
    entrega: { direccion: 'Aldama 1408, Centro', referencia: 'Portón negro', telefono: '6141234567', lat: 28.6321, lng: -106.0889 },
    fecha_entrega: '2026-11-15',
    al_recibir: true,
  };

  it('sin los campos nuevos la huella queda igual que antes', () => {
    expect(orderFingerprint(base)).toBe('efectivo|para_llevar|null||1:2:1,3');
  });

  it('un reintento idéntico da la misma huella (y la misma llave)', () => {
    const again = { ...home, entrega: { ...home.entrega }, items: [{ producto_id: 1, cantidad: 2, opcion_ids: [1, 3] }] };
    expect(orderFingerprint(again)).toBe(orderFingerprint(home));
    expect(idempotencyKeyFor(orderFingerprint(again))).toBe(idempotencyKeyFor(orderFingerprint(home)));
  });

  it.each([
    ['la dirección', { entrega: { ...home.entrega, direccion: 'Aldama 1410, Centro' } }],
    ['la latitud', { entrega: { ...home.entrega, lat: 28.6322 } }],
    ['la longitud', { entrega: { ...home.entrega, lng: -106.089 } }],
    ['quitar las coordenadas', { entrega: { direccion: home.entrega.direccion, referencia: home.entrega.referencia, telefono: home.entrega.telefono } }],
    ['el teléfono', { entrega: { ...home.entrega, telefono: '6149876543' } }],
    ['la referencia', { entrega: { ...home.entrega, referencia: 'Casa azul' } }],
    ['fecha_entrega', { fecha_entrega: '2026-11-16' }],
    ['quitar fecha_entrega', { fecha_entrega: undefined }],
    ['al_recibir', { al_recibir: undefined }],
    ['con_anticipo', { metodo_pago: 'stripe', al_recibir: undefined, con_anticipo: true }],
  ])('cambia al cambiar %s', (_label, change) => {
    const changed = { ...home, ...change };
    expect(orderFingerprint(changed)).not.toBe(orderFingerprint(home));
    expect(idempotencyKeyFor(orderFingerprint(changed))).not.toBe(idempotencyKeyFor(orderFingerprint(home)));
  });

  it('la forma de pago a domicilio distingue anticipo de tarjeta completa', () => {
    const card = { ...home, metodo_pago: 'stripe', al_recibir: undefined };
    expect(orderFingerprint({ ...card, con_anticipo: true })).not.toBe(orderFingerprint(card));
  });

  it('un separador dentro de la dirección no se confunde con otro campo', () => {
    const a = { ...home, entrega: { ...home.entrega, direccion: 'A|B', referencia: 'C' } };
    const b = { ...home, entrega: { ...home.entrega, direccion: 'A', referencia: 'B|C' } };
    expect(orderFingerprint(a)).not.toBe(orderFingerprint(b));
  });
});
