/**
 * Token de dispositivo por participante de mesa (QA_SEGURIDAD 2026-11-02). El servidor lo
 * entrega una sola vez al sentarse o retomar (`dispositivo_token`) y guarda solo su hash;
 * este teléfono lo presenta para seguir siendo ese participante. Vive en el almacenamiento
 * del navegador, por participante y sesión, se rota en cada toma y se borra al salir de la
 * mesa o cuando la sesión se cierra.
 */
const KEY = "vaiinilla.mesa.dispositivo";
const MAX = 20;

type Entry = { token: string; sesion: string | null };
type Store = Record<string, Entry>;

function read(): Store {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    const out: Store = {};
    for (const [id, v] of Object.entries(parsed as Record<string, unknown>)) {
      const e = v as Partial<Entry> | null;
      if (e && typeof e.token === "string")
        out[id] = { token: e.token, sesion: e.sesion ?? null };
    }
    return out;
  } catch {
    return {};
  }
}

function write(store: Store): void {
  try {
    if (Object.keys(store).length === 0)
      globalThis.localStorage?.removeItem(KEY);
    else globalThis.localStorage?.setItem(KEY, JSON.stringify(store));
  } catch {
    // Sin almacenamiento: el participante se puede retomar con ayuda del mesero.
  }
}

export function tableDeviceToken(participantId: string): string | null {
  return read()[participantId]?.token ?? null;
}

export function saveTableDeviceToken(
  participantId: string,
  token: string,
  sesion: string | null = null,
): void {
  const store = read();
  delete store[participantId];
  store[participantId] = { token, sesion };
  const keys = Object.keys(store);
  for (const old of keys.slice(0, Math.max(0, keys.length - MAX)))
    delete store[old];
  write(store);
}

/** Al salir de la mesa o al ver que ya no hay sesión abierta: borra todos los tokens. */
export function clearTableDeviceTokens(): void {
  write({});
}

/** Con la sesión vigente conocida, borra los tokens de sesiones que ya cerraron. */
export function pruneTableDeviceTokens(sesionVigente: string): void {
  const store = read();
  let changed = false;
  for (const [id, e] of Object.entries(store)) {
    if (e.sesion && e.sesion !== sesionVigente) {
      delete store[id];
      changed = true;
    }
  }
  if (changed) write(store);
}
