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

  it('prioriza cuenta cobrada con pago diferido y pendiente', () => {
    expect(statusAsPhrase(order({ estado: 'cobrado', pago_diferido: true, pago_pendiente: true }))).toBe(
      'Tu pedido está en la cuenta',
    );
  });

  it('mantiene entregado por pagar con pago diferido', () => {
    expect(statusAsPhrase(order({ estado: 'entregado', pago_diferido: true, pago_pendiente: true }))).toBe(
      'Tu pedido está por pagar',
    );
  });

  it('no interpreta pago diferido sin pago pendiente como cuenta abierta', () => {
    expect(statusAsPhrase(order({ estado: 'cobrado', pago_diferido: true, pago_pendiente: false }))).toBe(
      'Recibimos tu pedido',
    );
  });

  it('indica cuando venció un apartado', () => {
    expect(statusAsPhrase(order({
      estado: 'por_cobrar',
      reserva: { estado: 'pendiente_pago', inicio: '2026-11-01T12:00:00Z', fin: '2026-11-01T13:00:00Z', expira_en: '2026-10-31T11:00:00Z' },
    } as Partial<OrderDetail>), new Date('2026-10-31T12:00:00Z'))).toBe('El apartado venció');
  });

  it('devuelve una frase para cada estado de reserva', () => {
    const now = new Date('2026-10-31T10:00:00Z');
    const reservation = (estado: string, inicio: string, fin: string) => ({
      estado, inicio, fin, expira_en: '2026-10-31T11:00:00Z',
    });
    expect(statusAsPhrase(order({ estado: 'por_cobrar', reserva: reservation('pendiente_pago', '2026-11-01T12:00:00Z', '2026-11-01T13:00:00Z') as never }), now)).toBe('Falta pagar tu reserva');
    expect(statusAsPhrase(order({ estado: 'cobrado', reserva: reservation('confirmada', '2026-11-01T12:00:00Z', '2026-11-01T13:00:00Z') as never }), now)).toBe('Tu cancha está reservada');
    expect(statusAsPhrase(order({ estado: 'cobrado', reserva: reservation('en_curso', '2026-10-31T09:00:00Z', '2026-10-31T11:00:00Z') as never }), now)).toBe('Tu horario está en curso');
    expect(statusAsPhrase(order({ estado: 'cobrado', reserva: reservation('terminada', '2026-10-31T08:00:00Z', '2026-10-31T09:00:00Z') as never }), now)).toBe('Tu horario terminó');
    expect(statusAsPhrase(order({ estado: 'cobrado', reserva: reservation('conflicto', '2026-11-01T12:00:00Z', '2026-11-01T13:00:00Z') as never }), now)).toBe('Consulta con el personal sobre tu reserva');
    expect(statusAsPhrase(order({ estado: 'cobrado', reserva: reservation('expirada', '2026-11-01T12:00:00Z', '2026-11-01T13:00:00Z') as never }), now)).toBe('La reserva venció');
    expect(statusAsPhrase(order({ estado: 'cobrado', reserva: reservation('cancelada', '2026-11-01T12:00:00Z', '2026-11-01T13:00:00Z') as never }), now)).toBe('La reserva fue cancelada');
  });

  it('da una frase no vacía para un estado desconocido', () => {
    expect(statusAsPhrase(order({ estado: 'estado_nuevo' as OrderDetail['estado'] }))).toBe('Revisa el estado de tu pedido');
  });
});
