import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  forgetIdempotencyKey,
  idempotencyKeyFor,
  orderFingerprint,
  readIdempotencyKey,
  sha256Hex,
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

describe('sessionStorage guarda el SHA-256 de la huella, no la huella en claro', () => {
  const home = {
    metodo_pago: 'efectivo',
    destino: 'a_domicilio',
    espacio_id: null,
    notas_cocina: null,
    items: [{ producto_id: 1, cantidad: 1, opcion_ids: [] }],
    entrega: { direccion: 'Aldama 1408, Centro', referencia: 'Portón negro', telefono: '6141234567', lat: 28.6321, lng: -106.0889 },
    al_recibir: true,
  };

  beforeEach(() => {
    sessionStorage.clear();
  });

  it('sha256Hex coincide con el SHA-256 de Node (vectores conocidos, UTF-8 y varios bloques)', () => {
    for (const text of ['', 'abc', 'Portón ñandú · 6141234567', 'x'.repeat(55), 'x'.repeat(56), 'y'.repeat(1000), orderFingerprint(home)]) {
      expect(sha256Hex(text)).toBe(createHash('sha256').update(text, 'utf8').digest('hex'));
    }
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('la llave guardada es el hash y no queda la dirección, el teléfono ni la huella', () => {
    const fingerprint = orderFingerprint(home);
    const key = idempotencyKeyFor(fingerprint);
    const raw = sessionStorage.getItem('vaiinilla.buyer.idempotency.v2') ?? '';
    expect(JSON.parse(raw)).toEqual({ [sha256Hex(fingerprint)]: key });
    const everything = Object.keys(sessionStorage)
      .map((name) => `${name}=${sessionStorage.getItem(name)}`)
      .join('\n');
    expect(everything).not.toContain('Aldama');
    expect(everything).not.toContain('6141234567');
    expect(everything).not.toContain('Portón');
    expect(everything).not.toContain(fingerprint);
  });

  it('un reintento idéntico reusa la misma llave y forget la borra', () => {
    const first = idempotencyKeyFor(orderFingerprint(home));
    expect(idempotencyKeyFor(orderFingerprint({ ...home, entrega: { ...home.entrega } }))).toBe(first);
    expect(readIdempotencyKey(orderFingerprint(home))).toBe(first);
    forgetIdempotencyKey(orderFingerprint(home));
    expect(readIdempotencyKey(orderFingerprint(home))).toBeUndefined();
    expect(idempotencyKeyFor(orderFingerprint(home))).not.toBe(first);
  });

  it('borra el mapa v1, que guardaba la huella en claro, y descarta llaves que no son hash', () => {
    sessionStorage.setItem('vaiinilla.buyer.idempotency.v1', JSON.stringify({ [orderFingerprint(home)]: 'vieja' }));
    sessionStorage.setItem('vaiinilla.buyer.idempotency.v2', JSON.stringify({ 'Aldama 1408|6141234567': 'colada' }));
    idempotencyKeyFor('otra huella');
    expect(sessionStorage.getItem('vaiinilla.buyer.idempotency.v1')).toBeNull();
    const map = JSON.parse(sessionStorage.getItem('vaiinilla.buyer.idempotency.v2') ?? '{}') as Record<string, string>;
    expect(Object.keys(map)).toEqual([sha256Hex('otra huella')]);
  });
});

describe('orderFingerprint con pago_diferido y confirmar_para_llevar', () => {
  const base = {
    metodo_pago: 'efectivo',
    destino: 'para_llevar',
    espacio_id: null,
    notas_cocina: null,
    items: [{ producto_id: 1, cantidad: 2, opcion_ids: [3, 1] }],
  };

  it('sin esos campos la huella queda igual que antes', () => {
    expect(orderFingerprint(base)).toBe('efectivo|para_llevar|null||1:2:1,3');
  });

  it('cambia con pago_diferido', () => {
    const table = { ...base, destino: 'en_espacio', espacio_id: 7 };
    expect(orderFingerprint({ ...table, pago_diferido: true })).not.toBe(orderFingerprint({ ...table, pago_diferido: false }));
    expect(orderFingerprint({ ...table, pago_diferido: false })).not.toBe(orderFingerprint(table));
    expect(orderFingerprint({ ...table, pago_diferido: true })).toBe(orderFingerprint({ ...table, pago_diferido: true }));
  });

  it('cambia con confirmar_para_llevar', () => {
    expect(orderFingerprint({ ...base, confirmar_para_llevar: true })).not.toBe(orderFingerprint(base));
    expect(orderFingerprint({ ...base, pago_diferido: false, confirmar_para_llevar: true })).not.toBe(
      orderFingerprint({ ...base, pago_diferido: false }),
    );
  });
});
