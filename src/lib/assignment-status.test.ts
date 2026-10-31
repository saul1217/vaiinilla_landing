import { describe, expect, it } from 'vitest';
import { assignmentStatus } from './assignment-status';
import type { SharedTableOrder } from '../types/api';

const order = (overrides: Partial<SharedTableOrder> = {}): SharedTableOrder => ({
  id: 'order-1',
  folio: 1,
  estado: 'entregado',
  items_resumen: 'Comida',
  total: '100.00',
  pendiente_cobro: true,
  creado_en: null,
  ...overrides,
});

describe('assignmentStatus', () => {
  it('resume pedidos marcados y sin asignar', () => {
    expect(assignmentStatus([order({ lo_pago_yo: true }), order({ id: 'order-2' })])).toBe(
      '1 marcado para pagar · 1 por asignar',
    );
  });

  it('omite pedidos ya asignados a otra persona', () => {
    expect(assignmentStatus([order({ pagara: 'Ana' })])).toBe('');
  });

  it('no cuenta como pendientes los pedidos que no requieren cobro', () => {
    expect(assignmentStatus([order({ pendiente_cobro: false })])).toBe('');
  });
});
