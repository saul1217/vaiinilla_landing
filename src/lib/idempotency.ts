import type { DeliveryInput } from '../types/api';

// v2: la llave de cada entrada es el SHA-256 de la huella, no la huella en claro (lleva dirección y
// teléfono de los pedidos a domicilio). La v1 guardaba la huella en claro y se borra al leer.
const MAP_NAME = 'vaiinilla.buyer.idempotency.v2';
const LEGACY_MAP_NAME = 'vaiinilla.buyer.idempotency.v1';
const HASH_PATTERN = /^[0-9a-f]{64}$/;

export function createIdempotencyKey(): string {
  return crypto.randomUUID();
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

/**
 * SHA-256 en hexadecimal (FIPS 180-4), síncrono: las pantallas piden la llave sin esperar, y
 * `crypto.subtle` es asíncrono y no existe fuera de https. Solo sirve para no guardar la huella en claro.
 */
export function sha256Hex(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const bitLength = bytes.length * 8;
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(padded.length - 4, bitLength >>> 0);
  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const w15 = w[i - 15]!;
      const w2 = w[i - 2]!;
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash as unknown as number[];
    for (let i = 0; i < 64; i += 1) {
      const s1 = rotr(e!, 6) ^ rotr(e!, 11) ^ rotr(e!, 25);
      const ch = (e! & f!) ^ (~e! & g!);
      const t1 = (h! + s1 + ch + SHA256_K[i]! + w[i]!) >>> 0;
      const s0 = rotr(a!, 2) ^ rotr(a!, 13) ^ rotr(a!, 22);
      const maj = (a! & b!) ^ (a! & c!) ^ (b! & c!);
      const t2 = (s0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d! + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    hash[0] = (hash[0]! + a!) >>> 0;
    hash[1] = (hash[1]! + b!) >>> 0;
    hash[2] = (hash[2]! + c!) >>> 0;
    hash[3] = (hash[3]! + d!) >>> 0;
    hash[4] = (hash[4]! + e!) >>> 0;
    hash[5] = (hash[5]! + f!) >>> 0;
    hash[6] = (hash[6]! + g!) >>> 0;
    hash[7] = (hash[7]! + h!) >>> 0;
  }
  return Array.from(hash, (word) => word.toString(16).padStart(8, '0')).join('');
}

function readKeyMap(): Record<string, string> {
  if (typeof sessionStorage === 'undefined') return {};
  try {
    sessionStorage.removeItem(LEGACY_MAP_NAME);
    const raw = sessionStorage.getItem(MAP_NAME);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    // Solo entradas con llave de hash: nada que parezca una huella en claro sobrevive.
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, string] => HASH_PATTERN.test(entry[0]) && typeof entry[1] === 'string',
      ),
    );
  } catch {
    return {};
  }
}

function writeKeyMap(map: Record<string, string>): void {
  sessionStorage.setItem(MAP_NAME, JSON.stringify(map));
}

export function readIdempotencyKey(fingerprint: string): string | undefined {
  const value = readKeyMap()[sha256Hex(fingerprint)];
  return typeof value === 'string' && value ? value : undefined;
}

export function rememberIdempotencyKey(fingerprint: string, key: string): void {
  const next = readKeyMap();
  next[sha256Hex(fingerprint)] = key;
  writeKeyMap(next);
}

export function forgetIdempotencyKey(fingerprint: string): void {
  const next = readKeyMap();
  delete next[sha256Hex(fingerprint)];
  writeKeyMap(next);
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
 * respondería 409 IDEMPOTENCY_KEY_REUSED. Lo de domicilio, encargos, pago_diferido y confirmar_para_llevar
 * solo entra cuando viene, para que la huella de los pedidos sin esos campos quede igual que antes. La
 * huella nunca se guarda así: en sessionStorage va su SHA-256.
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
  pago_diferido?: boolean;
  confirmar_para_llevar?: boolean;
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
  if (payload.pago_diferido !== undefined) parts.push(`pago_diferido=${payload.pago_diferido}`);
  if (payload.confirmar_para_llevar !== undefined) {
    parts.push(`confirmar_para_llevar=${payload.confirmar_para_llevar}`);
  }
  return parts.join('|');
}
