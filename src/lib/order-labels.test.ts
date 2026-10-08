import { describe, expect, it } from 'vitest';
import type { OrderDetail } from '../types/api';
import {
  belongsToActiveTable,
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
import type { SharedTable } from '../types/api';

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
  it('solo mantiene operativos los pedidos de mesa incluidos en la sesión activa', () => {
    const active: SharedTable = {
      espacio: { id: 5, nombre: 'Mesa 5', tipo: 'mesa' },
      sesion_id: 'ses-b',
      mi_alias: 'Kikin',
      mi_participante: { id: 'p-b', alias: 'Kikin' },
      cuenta_abierta: true,
      participantes: [],
      grupos: [{
        alias: 'Kikin', participante_id: 'p-b', soy_yo: true,
        total: '20.00', pagado: '0.00', pendiente: '20.00',
        pedidos: [{ id: 'o-2', folio: 2, estado: 'listo', items_resumen: 'Agua', total: '20.00', pendiente_cobro: true, creado_en: null }],
      }],
      totales: { total: '20.00', pagado: '0.00', pendiente: '20.00' },
      mi_parte: { total: '20.00', pagado: '0.00', pendiente: '20.00' },
    };
    expect(belongsToActiveTable(order({ folio: 1, espacio: { id: 5, nombre: 'Mesa 5', tipo: 'mesa' } }), active)).toBe(false);
    expect(belongsToActiveTable(order({ folio: 2, espacio: { id: 5, nombre: 'Mesa 5', tipo: 'mesa' } }), active)).toBe(true);
    expect(belongsToActiveTable(order({ folio: 1, espacio: { id: 9, nombre: 'Mesa 9', tipo: 'mesa' } }), active)).toBe(false);
    expect(belongsToActiveTable(order({ espacio: null }), null)).toBe(true);
  });

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
