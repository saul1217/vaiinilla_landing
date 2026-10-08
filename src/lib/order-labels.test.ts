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
  isOrderPaid,
  orderPayLabel,
  orderStatusLabel,
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
      'Pedido recibido',
      'Preparando',
      'Listo',
      'Entregado',
    ]);
    expect(orderTrackSteps(cash)[0]?.state).toBe('current');
  });

  it('mantiene el pago separado del avance operativo para tarjeta confirmada', () => {
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
    expect(steps.map((step) => step.label)).toEqual(['Pedido recibido', 'Preparando', 'Listo', 'Entregado']);
    expect(steps[0]?.state).toBe('current');
    expect(orderProgressFilled(card)).toBe(1);
    expect(orderMetaLine(card)).toBe('Para llevar · Tarjeta');
  });

  it('no afirma que se pagó una cuenta diferida basándose en `cobrado` ni en el booleano legado', () => {
    const tableOrder = order({
      estado: 'cobrado',
      estado_operativo: 'recibido',
      estado_pago: 'pendiente',
      saldo_pendiente: '73.70',
      pago_diferido: true,
      pago_pendiente: false,
    });
    expect(orderCompactPayLabel(tableOrder)).toBe('Al final');
    expect(orderTrackSteps(tableOrder).map((step) => step.label)).toEqual([
      'Pedido recibido', 'Preparando', 'Listo', 'Entregado',
    ]);
    expect(orderTrackSteps(tableOrder)[0]?.hint).toContain('cuenta de mesa');
    expect(orderStatusLabel(tableOrder)).toBe('Pedido recibido');
    expect(orderPayLabel(tableOrder)).toBe('Se paga al final');
  });

  it('no infiere un pago Stripe desde el estado operativo legado', () => {
    const stripe = order({
      estado: 'cobrado',
      metodo_pago: 'stripe',
      pago: {
        payment_attempt_id: 'a1',
        payment_intent_id: 'pi',
        stripe_account_id: 'acct',
        payment_status: 'confirmado',
      },
    });
    expect(isOrderPaid(stripe)).toBe(false);
    expect(orderPayLabel(stripe)).toBe('Tarjeta');
    expect(isOrderPaid({ ...stripe, saldo_pendiente: '0.00' })).toBe(true);
  });

  it('marca LISTO como paso 3 actual, no como palomita', () => {
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
    expect(steps[2]?.label).toBe('Listo');
    expect(steps[2]?.state).toBe('current');
    expect(steps[2]?.hint).toBe('');
    expect(orderProgressFilled(ready)).toBe(3);
    expect(steps.slice(0, 2).every((step) => step.state === 'done')).toBe(true);
    expect(steps[3]?.state).toBe('todo');
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
    expect(orderTrackSteps(preparing)[2]?.hint).toBe('Recógelo en la barra.');
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

  it('nombra cada artículo, sin el (N) crudo, y resume después de tres', () => {
    const line = (id: number, nombre: string, cantidad: number) => ({ ...items[1]!, id, nombre_producto: nombre, cantidad });
    expect(orderItemHeadline(order({ items: [line(1, 'Hamburguesa', 2), line(2, 'Refresco', 1)] }))).toBe(
      '2 Hamburguesa, 1 Refresco',
    );
    expect(orderItemHeadline(order({ items: [line(1, 'Tacos dorados de res (5)', 1)] }))).toBe(
      '1 Tacos dorados de res · 5 pzs',
    );
    const many = [line(1, 'A', 1), line(2, 'B', 1), line(3, 'C', 1), line(4, 'D', 1), line(5, 'E', 1)];
    expect(orderItemHeadline(order({ items: many }))).toBe('1 A, 1 B, 1 C y 2 más');
  });

  it('avisa qué se quitó y por qué', () => {
    expect(orderRejectedItemsHint(order({ items }))).toBe('Se quitó Torta: Se terminó el pan.');
    expect(orderRejectedItemsHint(order({ items: [items[1]!] }))).toBeNull();
  });
});

describe('pedido sin cocina: Preparando omitido', () => {
  const drink = {
    id: 2,
    producto_id: 9,
    nombre_producto: 'Refresco',
    estacion_preparacion: 'caja' as const,
    cantidad: 1,
    precio_digital_unitario: '25.00',
    subtotal: '25.00',
    opciones: [],
  };

  it('a la cuenta, una bebida en listo marca Preparando como omitido, no hecho', () => {
    const steps = orderTrackSteps(order({ estado: 'listo', pago_diferido: true, items: [drink] }));
    const preparing = steps.find((step) => step.key === 'preparando');
    expect(preparing?.state).toBe('skipped');
    expect(preparing?.hint).toMatch(/no aplica/i);
    expect(steps.find((step) => step.key === 'listo')?.state).toBe('current');
    expect(steps.find((step) => step.key === 'entregado')?.state).toBe('todo');
  });

  it('también en un pedido normal sin cocina', () => {
    const steps = orderTrackSteps(order({ estado: 'listo', items: [drink] }));
    expect(steps.find((step) => step.key === 'preparando')?.state).toBe('skipped');
  });

  it('con un artículo de cocina, Preparando sigue normal', () => {
    const base = order({ estado: 'listo', pago_diferido: true });
    const steps = orderTrackSteps({ ...base, items: [...base.items, drink] });
    expect(steps.find((step) => step.key === 'preparando')?.state).toBe('done');
  });
});
