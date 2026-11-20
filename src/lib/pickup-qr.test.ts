import { beforeEach, describe, expect, it } from 'vitest';
import {
  isShortPickupCode,
  pickupQrPayloadFromOrder,
  readPickupQrToken,
  rememberPickupQrToken,
  resolvePickupQrToken,
  shouldShowPickupQr,
  shouldShowPickupSurface,
  pickupProofs,
  myCodeOrders,
} from './pickup-qr';
import type { OrderDetail } from '../types/api';

function order(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    id: 'ord-1',
    folio: 1,
    fecha_operativa: '2026-09-18',
    estado: 'listo',
    metodo_pago: 'stripe',
    destino: 'para_llevar',
    espacio: null,
    subtotal: '16.50',
    ahorro_combinado: '0.00',
    cashback_otorgado: '0.00',
    total: '16.50',
    version: 1,
    creado_en: '2026-09-18T12:00:00Z',
    actualizado_en: '2026-09-18T12:00:00Z',
    notas_cocina: null,
    usuario: { nombre: 'Ana', matricula: null },
    items: [],
    pago: {
      payment_attempt_id: 'attempt-1',
      payment_intent_id: 'pi_1',
      stripe_account_id: 'acct_1',
      payment_status: 'confirmado',
    },
    ...overrides,
  };
}

describe('pickup-qr', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('guarda el token en localStorage para una visita nueva', () => {
    rememberPickupQrToken('ord-1', 'pickup-secret');
    expect(localStorage.getItem('vaiinilla.buyer.pickup-qr.v1.ord-1')).toBe('pickup-secret');
    sessionStorage.clear();
    expect(readPickupQrToken('ord-1')).toBe('pickup-secret');
  });

  it('migra un token viejo de sessionStorage a localStorage', () => {
    sessionStorage.setItem('vaiinilla.buyer.pickup-qr.v1.ord-1', 'legacy-token');
    expect(readPickupQrToken('ord-1')).toBe('legacy-token');
    expect(localStorage.getItem('vaiinilla.buyer.pickup-qr.v1.ord-1')).toBe('legacy-token');
  });

  it('no usa el folio como secreto de QR', () => {
    const next = order({ folio: 42, qr_token: null });
    (next as OrderDetail & { codigo?: string }).codigo = '42';
    expect(pickupQrPayloadFromOrder(next)).toBeNull();
    expect(resolvePickupQrToken(next)).toBeNull();
  });

  it('toma qr_token del pedido si el API lo envía', () => {
    expect(pickupQrPayloadFromOrder(order({ qr_token: 'server-token' }))).toBe('server-token');
  });

  it('muestra retiro en listo y QR solo con token', () => {
    const ready = order({ qr_token: undefined });
    expect(shouldShowPickupSurface(ready)).toBe(true);
    expect(shouldShowPickupQr(ready, null)).toBe(false);
    expect(shouldShowPickupQr(ready, 'abc')).toBe(true);
    expect(shouldShowPickupSurface(order({ estado: 'cobrado' }))).toBe(false);
    expect(shouldShowPickupSurface(order({ estado: 'preparando' }))).toBe(false);
    expect(
      shouldShowPickupSurface(
        order({ estado: 'por_cobrar', pago: { ...ready.pago!, payment_status: 'pendiente_pago' } }),
      ),
    ).toBe(false);
  });

  it('reconoce un código corto para mostrarlo en texto', () => {
    expect(isShortPickupCode('QA94LISTO')).toBe(true);
    expect(isShortPickupCode('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toBe(false);
  });
});

describe('qué prueba enseña el cliente (225 y 227)', () => {
  const listo = { id: 'p', folio: 1, estado: 'listo', metodo_pago: 'efectivo' } as unknown as OrderDetail;
  const porCobrar = { ...listo, estado: 'por_cobrar' } as OrderDetail;

  it.each([
    [undefined, { code: true, qr: 'show' }],
    ['qr_o_codigo', { code: true, qr: 'show' }],
    ['qr', { code: false, qr: 'show' }],
    ['codigo', { code: true, qr: 'folded' }],
    ['ninguna', { code: false, qr: 'hidden' }],
  ] as const)('listo con %s', (mode, expected) => {
    expect(pickupProofs(listo, { mode })).toEqual({ surface: true, ...expected });
  });

  it('por cobrar solo enseña algo con el cobro con código; «sin validar» cobra con QR o código', () => {
    expect(pickupProofs(porCobrar, { mode: 'codigo' }).surface).toBe(false);
    expect(pickupProofs(porCobrar, { mode: 'codigo', cobroCodigo: true })).toEqual({ surface: true, code: true, qr: 'folded' });
    expect(pickupProofs(porCobrar, { mode: 'ninguna', cobroCodigo: true })).toEqual({ surface: true, code: true, qr: 'show' });
    expect(pickupProofs({ ...porCobrar, metodo_pago: 'stripe' }, { cobroCodigo: true }).surface).toBe(false);
  });

  it('«Mi código»: listos, por pagar, en preparación y entregados; solo los de hoy', () => {
    const o = (folio: number, estado: string, fecha = '2026-11-20') =>
      ({ id: String(folio), folio, estado, fecha_operativa: fecha }) as unknown as OrderDetail;
    const list = myCodeOrders(
      [o(1, 'entregado'), o(2, 'preparando'), o(3, 'listo'), o(4, 'por_cobrar'), o(5, 'listo', '2026-11-19'), o(6, 'cancelado')],
      '2026-11-20',
    );
    expect(list.map((x) => x.folio)).toEqual([3, 4, 2, 1]);
  });
});
