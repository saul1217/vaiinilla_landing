import { describe, expect, it } from 'vitest';
import type { OrderDetail, OrderReservation } from '../types/api';
import {
  formatHoldCountdown,
  isLiveRental,
  rentalHoldRemainingMs,
  rentalScheduleLabel,
  rentalStateLabel,
  rentalStep,
  rentalStepHint,
} from './rental-tracking';

const NOW = new Date('2026-09-30T18:30:00');

function reserva(overrides: Partial<OrderReservation> = {}): OrderReservation {
  return {
    id: 'r1',
    espacio: { id: 7, nombre: 'Cancha 2', tipo: 'cancha' },
    inicio: '2026-09-30T19:00:00',
    fin: '2026-09-30T20:00:00',
    duracion_min: 60,
    estado: 'confirmada',
    ...overrides,
  };
}

function order(r: OrderReservation | null, estado: OrderDetail['estado'] = 'entregado') {
  return { reserva: r, estado } as Pick<OrderDetail, 'reserva' | 'estado'>;
}

describe('seguimiento de una renta', () => {
  it('un pedido que no es renta no tiene paso', () => {
    expect(rentalStep(order(null), NOW)).toBeNull();
  });

  it('sin pagar está por pagar, aunque el pedido siga vivo', () => {
    expect(rentalStep(order(reserva({ estado: 'pendiente_pago' }), 'por_cobrar'), NOW)).toBe('por_pagar');
  });

  it('pagada antes de su hora está reservada; dentro de su horario, en juego; después, terminada', () => {
    expect(rentalStep(order(reserva()), NOW)).toBe('reservada');
    expect(rentalStep(order(reserva()), new Date('2026-09-30T19:30:00'))).toBe('en_juego');
    expect(rentalStep(order(reserva()), new Date('2026-09-30T20:00:00'))).toBe('terminada');
  });

  it('el paso sale de la hora, no del estado de la reserva (se activa sola)', () => {
    const inProgress = reserva({ estado: 'en_curso' });
    expect(rentalStep(order(inProgress), new Date('2026-09-30T19:10:00'))).toBe('en_juego');
    expect(rentalStep(order(reserva({ estado: 'terminada' })), new Date('2026-09-30T21:00:00'))).toBe(
      'terminada',
    );
  });

  it('cancelada, vencida o en conflicto no tiene paso y se explica', () => {
    for (const [estado, label] of [
      ['cancelada', 'Cancelada'],
      ['expirada', 'Cancelada por tiempo de espera'],
      ['conflicto', 'Revisar con el personal'],
    ] as const) {
      const o = order(reserva({ estado }));
      expect(rentalStep(o, NOW)).toBeNull();
      expect(rentalStateLabel(o, NOW)).toBe(label);
    }
  });

  it('un pedido caído no se ve como renta viva aunque la reserva diga confirmada', () => {
    expect(rentalStep(order(reserva(), 'cancelado'), NOW)).toBeNull();
  });

  it('sigue en curso hasta que termina su horario', () => {
    expect(isLiveRental(order(reserva()), NOW)).toBe(true);
    expect(isLiveRental(order(reserva()), new Date('2026-09-30T19:59:00'))).toBe(true);
    expect(isLiveRental(order(reserva()), new Date('2026-09-30T20:00:00'))).toBe(false);
    expect(isLiveRental(order(reserva({ estado: 'cancelada' })), NOW)).toBe(false);
  });

  it('dice el día y la hora', () => {
    expect(rentalScheduleLabel(reserva(), NOW)).toBe('Hoy · 19:00–20:00');
    expect(
      rentalScheduleLabel(reserva({ inicio: '2026-10-01T18:00:00', fin: '2026-10-01T19:30:00' }), NOW),
    ).toBe('Mañana · 18:00–19:30');
    expect(
      rentalScheduleLabel(reserva({ inicio: '2026-10-03T07:00:00', fin: '2026-10-03T08:00:00' }), NOW),
    ).toBe('Sáb 3 oct · 07:00–08:00');
  });

  it('cada paso dice qué sigue, sin hablar de cocina', () => {
    const r = reserva();
    expect(rentalStepHint('por_pagar', r, 'efectivo', false, NOW)).toBe('Paga en caja para confirmar tu horario.');
    expect(rentalStepHint('por_pagar', r, 'stripe', false, NOW)).toMatch(/pago con tarjeta/);
    expect(rentalStepHint('por_pagar', r, 'stripe', true, NOW)).toMatch(/Reintenta/);
    expect(rentalStepHint('reservada', r, 'saldo', false, NOW)).toBe('Te esperamos hoy a las 19:00.');
    expect(rentalStepHint('en_juego', r, 'saldo', false, NOW)).toBe('Tu horario termina a las 20:00.');
    expect(rentalStepHint('terminada', r, 'saldo', false, NOW)).toBe('Gracias por jugar.');
    for (const step of ['por_pagar', 'reservada', 'en_juego', 'terminada'] as const) {
      expect(rentalStepHint(step, r, 'efectivo', false, NOW)).not.toMatch(/cocina|comanda|llevar/i);
    }
  });
});

describe('apartado de una renta por pagar', () => {
  const hold = reserva({ estado: 'pendiente_pago', expira_en: '2026-09-30T18:40:00' });

  it('mientras corre dice hasta qué hora está apartado y cuenta el tiempo', () => {
    expect(rentalHoldRemainingMs(order(hold, 'por_cobrar'), NOW)).toBe(10 * 60 * 1000);
    expect(formatHoldCountdown(9 * 60 * 1000 + 5000)).toBe('09:05');
    expect(rentalStepHint('por_pagar', hold, 'efectivo', false, NOW)).toMatch(/apartado hasta las 18:40/);
  });

  it('al vencer avisa y ya no pide pagar en caja', () => {
    const later = new Date('2026-09-30T18:40:01');
    expect(rentalStepHint('por_pagar', hold, 'efectivo', false, later)).toBe('El apartado venció; vuelve a elegir horario.');
    expect(rentalStateLabel(order(hold, 'por_cobrar'), later)).toBe('Apartado vencido');
  });

  it('sin apartado corriendo (confirmada o sin dato) no hay contador', () => {
    expect(rentalHoldRemainingMs(order(reserva({ expira_en: '2026-09-30T18:40:00' })), NOW)).toBeNull();
    expect(rentalHoldRemainingMs(order(reserva({ estado: 'pendiente_pago' }), 'por_cobrar'), NOW)).toBeNull();
    expect(rentalHoldRemainingMs(order(null), NOW)).toBeNull();
  });
});
