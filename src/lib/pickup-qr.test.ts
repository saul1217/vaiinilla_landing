import { beforeEach, describe, expect, it } from 'vitest';
import {
  isShortPickupCode,
  pickupQrPayloadFromOrder,
  readPickupQrToken,
  rememberPickupQrToken,
  resolvePickupQrToken,
  shouldShowPickupQr,
  shouldShowPickupSurface,
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

  it('muestra retiro en cobrado+ confirmado y QR solo con token', () => {
    const paid = order({ qr_token: undefined });
    expect(shouldShowPickupSurface(paid)).toBe(true);
    expect(shouldShowPickupQr(paid, null)).toBe(false);
    expect(shouldShowPickupQr(paid, 'abc')).toBe(true);
    expect(shouldShowPickupSurface(order({ estado: 'por_cobrar', pago: { ...paid.pago!, payment_status: 'pendiente_pago' } }))).toBe(false);
  });

  it('reconoce un código corto para mostrarlo en texto', () => {
    expect(isShortPickupCode('QA94LISTO')).toBe(true);
    expect(isShortPickupCode('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toBe(false);
  });
});
