import { describe, expect, it } from 'vitest';
import type { OrderDetail } from '../types/api';
import {
  orderCancelReason,
  orderRejectedItemsHint,
  orderCollapsedStatusHint,
  orderCompactPayLabel,
  orderHistoryHeadline,
  orderItemHeadline,
  orderMetaLine,
  orderProgressFilled,
  orderTrackSteps,
} from './order-labels';

function order(overrides: Partial<OrderDetail>): OrderDetail {
  return {
    id: 'ord-1',
    folio: 95,
    fecha_operativa: '2026-09-17',
    estado: 'por_cobrar',
    metodo_pago: 'efectivo',
    destino: 'para_llevar',
    espacio: null,
    subtotal: '73.70',
    ahorro_combinado: '0.00',
    cashback_otorgado: '0.00',
    total: '73.70',
    version: 1,
    creado_en: '2026-09-17T12:00:00Z',
    actualizado_en: '2026-09-17T12:00:00Z',
    notas_cocina: null,
    usuario: { nombre: 'Ana', matricula: null },
    items: [
      {
        id: 1,
        producto_id: 1,
        nombre_producto: 'Quiere keke',
        estacion_preparacion: 'cocina',
        cantidad: 1,
        precio_digital_unitario: '73.70',
        subtotal: '73.70',
        opciones: [],
      },
    ],
    pago: null,
    ...overrides,
  };
}

describe('order-labels Android tracking', () => {
  it('arma titular, meta y barra de efectivo', () => {
    const cash = order({});
    expect(orderItemHeadline(cash)).toBe('1 Quiere keke');
    expect(orderHistoryHeadline(cash)).toBe('1× Quiere keke');
    expect(orderMetaLine(cash)).toBe('Para llevar · Efectivo');
    expect(orderCompactPayLabel(cash)).toBe('Efectivo');
    expect(orderProgressFilled(cash)).toBe(1);
    expect(orderTrackSteps(cash).map((step) => step.label)).toEqual([
      'Por cobrar',
      'Cobrado',
      'Preparando',
      'Listo',
      'Entregado',
    ]);
    expect(orderTrackSteps(cash)[0]?.state).toBe('current');
  });

  it('sustituye por cobrar con pago confirmado en tarjeta cobrada', () => {
    const card = order({
      estado: 'cobrado',
      metodo_pago: 'stripe',
      pago: {
        payment_attempt_id: 'a1',
        payment_intent_id: 'pi',
        stripe_account_id: 'acct',
        payment_status: 'confirmado',
      },
    });
    const steps = orderTrackSteps(card);
    expect(steps[0]?.label).toBe('Pago confirmado');
    expect(steps[0]?.state).toBe('done');
    expect(steps[1]?.label).toBe('Cobrado');
    expect(steps[1]?.state).toBe('current');
    expect(orderProgressFilled(card)).toBe(2);
    expect(orderMetaLine(card)).toBe('Para llevar · Tarjeta');
  });

  it('marca LISTO como paso 4 actual, no como palomita', () => {
    const ready = order({
      estado: 'listo',
      metodo_pago: 'stripe',
      pago: {
        payment_attempt_id: 'a1',
        payment_intent_id: 'pi',
        stripe_account_id: 'acct',
        payment_status: 'confirmado',
      },
    });
    const steps = orderTrackSteps(ready);
    expect(steps[3]?.label).toBe('Listo');
    expect(steps[3]?.state).toBe('current');
    expect(steps[3]?.hint).toBe('');
    expect(orderProgressFilled(ready)).toBe(4);
    expect(steps.slice(0, 3).every((step) => step.state === 'done')).toBe(true);
    expect(steps[4]?.state).toBe('todo');
  });

  it('deja Recógelo en la barra para LISTO futuro', () => {
    const preparing = order({
      estado: 'preparando',
      metodo_pago: 'stripe',
      pago: {
        payment_attempt_id: 'a1',
        payment_intent_id: 'pi',
        stripe_account_id: 'acct',
        payment_status: 'confirmado',
      },
    });
    expect(orderTrackSteps(preparing)[3]?.hint).toBe('Recógelo en la barra.');
  });

  it('en fila colapsada LISTO es solo Listo, Recógelo queda al expandir', () => {
    expect(orderCollapsedStatusHint('listo')).toBe('');
    expect(orderCollapsedStatusHint('preparando')).toBe('Tu comida se está preparando.');
  });
});

describe('orderCancelReason', () => {
  it('shows the staff reason only on cancelled orders', () => {
    expect(orderCancelReason({ estado: 'cancelado', motivo_cancelacion: ' Se acabó la carne ' })).toBe('Motivo: Se acabó la carne');
    expect(orderCancelReason({ estado: 'cancelado', motivo_cancelacion: null })).toBeNull();
    expect(orderCancelReason({ estado: 'preparando', motivo_cancelacion: 'x' })).toBeNull();
  });
});

describe('rechazo por artículo', () => {
  const items = [
    { id: 1, producto_id: 1, nombre_producto: 'Torta', estacion_preparacion: 'cocina' as const, cantidad: 1, precio_digital_unitario: '50.00', subtotal: '50.00', opciones: [], rechazo: { motivo: 'Se terminó el pan', monto: '50.00' } },
    { id: 2, producto_id: 2, nombre_producto: 'Tacos', estacion_preparacion: 'cocina' as const, cantidad: 3, precio_digital_unitario: '20.00', subtotal: '60.00', opciones: [], rechazo: null },
  ];

  it('el título usa lo que sí se prepara', () => {
    expect(orderItemHeadline(order({ items }))).toBe('3 Tacos');
  });

  it('avisa qué se quitó y por qué', () => {
    expect(orderRejectedItemsHint(order({ items }))).toBe('Se quitó Torta: Se terminó el pan.');
    expect(orderRejectedItemsHint(order({ items: [items[1]!] }))).toBeNull();
  });
});
