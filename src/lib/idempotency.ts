import type { DeliveryInput } from '../types/api';

const STORAGE_KEY = 'vaiinilla.buyer.idempotency.v1';

export function createIdempotencyKey(): string {
  return crypto.randomUUID();
}

function readKeyMap(): Record<string, string> {
  if (typeof sessionStorage === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

export function readIdempotencyKey(fingerprint: string): string | undefined {
  const value = readKeyMap()[fingerprint];
  return typeof value === 'string' && value ? value : undefined;
}

export function rememberIdempotencyKey(fingerprint: string, key: string): void {
  const next = readKeyMap();
  next[fingerprint] = key;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function forgetIdempotencyKey(fingerprint: string): void {
  const next = readKeyMap();
  delete next[fingerprint];
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function idempotencyKeyFor(fingerprint: string): string {
  const existing = readIdempotencyKey(fingerprint);
  if (existing) return existing;
  const key = createIdempotencyKey();
  rememberIdempotencyKey(fingerprint, key);
  return key;
}

/**
 * Huella del pedido para reusar la Idempotency-Key solo en un reintento idéntico. El back compara el
 * cuerpo completo: si cambia el día, la dirección o la forma de pago a domicilio y se reusara la llave,
 * respondería 409 IDEMPOTENCY_KEY_REUSED. Lo de domicilio y encargos solo entra cuando viene, para que
 * la huella de los demás pedidos quede igual que antes.
 */
export function orderFingerprint(payload: {
  metodo_pago: string;
  destino: string;
  espacio_id: number | null;
  notas_cocina: string | null;
  items: Array<{ producto_id: number; cantidad: number; opcion_ids: number[] }>;
  entrega?: DeliveryInput;
  fecha_entrega?: string;
  al_recibir?: boolean;
  con_anticipo?: boolean;
}): string {
  const items = payload.items
    .map(
      (item) =>
        `${item.producto_id}:${item.cantidad}:${[...item.opcion_ids].sort((a, b) => a - b).join(',')}`,
    )
    .join('|');
  const parts: Array<string | number> = [
    payload.metodo_pago,
    payload.destino,
    payload.espacio_id ?? 'null',
    payload.notas_cocina ?? '',
    items,
  ];
  if (payload.entrega) {
    const { direccion, referencia, telefono, lat, lng } = payload.entrega;
    // JSON y no `|`: la dirección y la referencia son texto libre y podrían traer el separador.
    parts.push(`entrega=${JSON.stringify([direccion, referencia ?? null, telefono, lat ?? null, lng ?? null])}`);
  }
  if (payload.fecha_entrega !== undefined) parts.push(`fecha_entrega=${payload.fecha_entrega}`);
  if (payload.al_recibir !== undefined) parts.push(`al_recibir=${payload.al_recibir}`);
  if (payload.con_anticipo !== undefined) parts.push(`con_anticipo=${payload.con_anticipo}`);
  return parts.join('|');
}
