import type { OrderDetail, OrderSpace } from '../types/api';

export interface OrderSessionGroup {
  sessionId: string;
  sessionState: 'abierta' | 'cerrada' | null;
  spaceName: string;
  space: OrderSpace | null;
  startedAt: string | null;
  closedAt: string | null;
  orders: OrderDetail[];
}

export function groupOrdersBySession(orders: OrderDetail[]): OrderSessionGroup[] {
  const groups = new Map<string, OrderDetail[]>();
  for (const order of orders) {
    if (!order.sesion_espacio_id) continue;
    const current = groups.get(order.sesion_espacio_id) ?? [];
    current.push(order);
    groups.set(order.sesion_espacio_id, current);
  }
  return [...groups].map(([sessionId, items]) => {
    const sorted = [...items].sort((a, b) => a.creado_en.localeCompare(b.creado_en));
    return {
      sessionId,
      sessionState: sorted.find((order) => order.sesion_espacio_estado)?.sesion_espacio_estado ?? null,
      spaceName: sorted.find((order) => order.espacio?.nombre)?.espacio?.nombre ?? 'Mesa',
      space: sorted.find((order) => order.espacio)?.espacio ?? null,
      startedAt: sorted.find((order) => order.sesion_espacio_inicio)?.sesion_espacio_inicio ?? sorted[0]?.creado_en ?? null,
      closedAt: sorted.find((order) => order.sesion_espacio_cerrada_en)?.sesion_espacio_cerrada_en ?? null,
      orders: sorted,
    };
  }).sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''));
}
