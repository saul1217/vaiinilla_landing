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
