export function createIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function orderFingerprint(payload: {
  metodo_pago: string;
  destino: string;
  espacio_id: number | null;
  notas_cocina: string | null;
  items: Array<{ producto_id: number; cantidad: number; opcion_ids: number[] }>;
}): string {
  const items = payload.items
    .map(
      (item) =>
        `${item.producto_id}:${item.cantidad}:${[...item.opcion_ids].sort((a, b) => a - b).join(',')}`,
    )
    .join('|');
  return [
    payload.metodo_pago,
    payload.destino,
    payload.espacio_id ?? 'null',
    payload.notas_cocina ?? '',
    items,
  ].join('|');
}
