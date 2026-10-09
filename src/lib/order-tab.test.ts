import { describe, expect, it } from 'vitest';
import type { OrderDetail } from '../types/api';
import {
  canAnnounceArrival,
  isActiveOrder,
  openTab,
  orderCollapsedHint,
  orderCompactPayLabel,
  orderDestinationLabel,
  orderOperationalHint,
  orderMetaLine,
  orderPayLabel,
  orderStatusLabel,
  orderTrackSteps,
} from './order-labels';

const NOW = new Date('2026-09-30T18:30:00');

function order(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    id: 'o1',
    folio: 7,
    estado: 'cobrado',
    metodo_pago: 'efectivo',
    destino: 'en_espacio',
    espacio: { id: 4, nombre: 'Mesa 4', tipo: 'mesa' },
    total: '60.00',
    items: [{ id: 1, nombre_producto: 'Agua', cantidad: 2 }],
    ...overrides,
  } as OrderDetail;
}

const tab = (o: Partial<OrderDetail> = {}) => order({ pago_diferido: true, pago_pendiente: true, ...o });

function rental(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return order({
    estado: 'entregado',
    destino: 'para_llevar',
    espacio: null,
    metodo_pago: 'saldo',
    reserva: {
      id: 'r1',
      espacio: { id: 7, nombre: 'Cancha 2', tipo: 'cancha' },
      inicio: '2026-09-30T19:00:00',
      fin: '2026-09-30T20:00:00',
      duracion_min: 60,
      estado: 'confirmada',
    },
    ...overrides,
  });
}

describe('pedido a la cuenta (pagar al final)', () => {
  it('no se lee como cobrado: está en la cuenta', () => {
    expect(orderStatusLabel(tab(), NOW)).toBe('En tu cuenta');
    expect(orderPayLabel(tab())).toBe('Se paga al final');
    expect(orderCompactPayLabel(tab())).toBe('Al final');
    expect(orderMetaLine(tab(), NOW)).toBe('Mesa 4 · Al final');
    expect(orderCollapsedHint(tab(), NOW)).toMatch(/Pagas al final/);
  });

  it('entregado y sin pagar sigue en curso y pide la cuenta', () => {
    const delivered = tab({ estado: 'entregado' });
    expect(orderStatusLabel(delivered, NOW)).toBe('Por pagar');
    expect(isActiveOrder(delivered, NOW)).toBe(true);
    expect(orderCollapsedHint(delivered, NOW)).toMatch(/cuenta a tu mesero/);
  });

  it('ya pagada vuelve a leerse normal y deja de estar en curso al entregarse', () => {
    const paid = tab({ estado: 'entregado', pago_pendiente: false });
    expect(orderStatusLabel(paid, NOW)).toBe('Entregado');
    expect(orderPayLabel(paid)).toBe('Cuenta pagada');
    expect(isActiveOrder(paid, NOW)).toBe(false);
  });

  it('sus pasos son los de una cuenta, no "Por cobrar"', () => {
    const steps = orderTrackSteps(tab({ estado: 'preparando' }), NOW);
    expect(steps.map((s) => s.label)).toEqual([
      'Pedido enviado',
      'En tu cuenta',
      'Preparando',
      'Listo',
      'Entregado',
    ]);
    expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'current', 'todo', 'todo']);
    expect(steps.some((s) => /por cobrar/i.test(s.label))).toBe(false);
  });

  it('un pedido normal no cambia', () => {
    const plain = order({ estado: 'por_cobrar', destino: 'para_llevar', espacio: null });
    expect(orderStatusLabel(plain, NOW)).toBe('Por cobrar');
    expect(orderTrackSteps(plain, NOW)[0]?.label).toBe('Por cobrar');
  });
});

describe('tu cuenta abierta', () => {
  it('suma lo que está sin pagar y ni cuenta lo ya pagado ni lo cancelado', () => {
    const orders = [
      tab({ id: 'a', total: '60.00' }),
      tab({ id: 'b', total: '30.50', estado: 'entregado' }),
      tab({ id: 'c', total: '99.00', pago_pendiente: false }),
      tab({ id: 'd', total: '10.00', estado: 'cancelado' }),
      order({ id: 'e', total: '45.00' }),
    ];
    expect(openTab(orders)).toEqual({ count: 2, total: '90.50' });
  });

  it('sin pedidos a la cuenta no hay cuenta', () => {
    expect(openTab([order()])).toBeNull();
    expect(openTab([])).toBeNull();
  });
});

describe('renta en Mis pedidos', () => {
  it('muestra la cancha y el horario, y sus propios pasos', () => {
    const r = rental();
    expect(orderMetaLine(r, NOW)).toBe('Cancha 2 · Hoy · 19:00–20:00');
    expect(orderStatusLabel(r, NOW)).toBe('Reservada');
    expect(orderCollapsedHint(r, NOW)).toBe('Te esperamos hoy a las 19:00.');
    expect(orderTrackSteps(r, NOW).map((s) => s.label)).toEqual([
      'Por pagar',
      'Reservada',
      'En juego',
      'Terminada',
    ]);
    expect(orderTrackSteps(r, NOW).map((s) => s.state)).toEqual(['done', 'current', 'todo', 'todo']);
  });

  it('sigue en curso aunque su pedido ya esté entregado, hasta que termina', () => {
    expect(isActiveOrder(rental(), NOW)).toBe(true);
    expect(isActiveOrder(rental(), new Date('2026-09-30T20:30:00'))).toBe(false);
  });

  it('nunca habla de cocina ni de llevar', () => {
    const r = rental();
    const text = [orderMetaLine(r, NOW), orderStatusLabel(r, NOW), orderCollapsedHint(r, NOW)]
      .concat(orderTrackSteps(r, NOW).flatMap((s) => [s.label, s.hint]))
      .join(' ');
    expect(text).not.toMatch(/cocina|comanda|llevar|preparando|recógelo/i);
  });

  it('el ticket dice la cancha y que se paga en caja, no "al recoger" ni "para llevar"', () => {
    const r = rental({ estado: 'por_cobrar', metodo_pago: 'efectivo' });
    expect(orderPayLabel(r)).toBe('Efectivo en caja');
    expect(orderDestinationLabel(r)).toBe('Cancha 2');
    expect(orderPayLabel(rental({ metodo_pago: 'saldo' }))).toBe('Pagado con saldo');
  });

  it('una renta ya pagada no dice que Caja la procesará (aunque el backend marque caja inactiva)', () => {
    const paid = rental({ motivo_pendiente_operativo: 'caja_inactiva' });
    expect(orderOperationalHint(paid)).toBeNull();
    const unpaid = rental({ estado: 'por_cobrar', metodo_pago: 'efectivo', motivo_pendiente_operativo: 'caja_inactiva' });
    expect(orderOperationalHint(unpaid)).toMatch(/Caja lo procesará/);
  });

  it('una renta no es un pedido para avisar que llegaste', () => {
    expect(canAnnounceArrival(rental())).toBe(false);
  });
});

describe('ya llegué', () => {
  it('solo para pedidos para llevar que siguen vivos', () => {
    const base = { destino: 'para_llevar' as const, espacio: null };
    for (const estado of ['por_cobrar', 'cobrado', 'preparando', 'listo'] as const) {
      expect(canAnnounceArrival(order({ ...base, estado }))).toBe(true);
    }
    for (const estado of ['entregado', 'cancelado', 'expirado', 'no_recogido'] as const) {
      expect(canAnnounceArrival(order({ ...base, estado }))).toBe(false);
    }
    expect(canAnnounceArrival(order({ estado: 'preparando' }))).toBe(false);
  });
});
