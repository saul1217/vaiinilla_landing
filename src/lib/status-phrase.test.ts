import { describe, expect, it } from 'vitest';
import { statusAsPhrase } from './status-phrase';
import type { OrderDetail } from '../types/api';

const order = (overrides: Partial<OrderDetail>): OrderDetail => ({ estado: 'preparando', ...overrides } as OrderDetail);

describe('statusAsPhrase', () => {
  it('usa el código de estado del pedido', () => {
    expect(statusAsPhrase(order({ estado: 'preparando' }))).toBe('Estamos preparando tu pedido');
    expect(statusAsPhrase(order({ estado: 'listo' }))).toBe('Tu pedido está listo');
  });

  it('distingue la cuenta abierta por los códigos del pedido', () => {
    expect(statusAsPhrase(order({ estado: 'entregado', pago_diferido: true, pago_pendiente: true }))).toBe(
      'Tu pedido está por pagar',
    );
  });
});
