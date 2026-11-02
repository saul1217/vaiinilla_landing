/**
 * Token de dispositivo por participante de mesa (QA_SEGURIDAD 2026-11-02). El servidor lo
 * entrega una sola vez al sentarse o retomar (`dispositivo_token`) y guarda solo su hash;
 * este teléfono lo presenta para seguir siendo ese participante. Vive en el almacenamiento
 * del navegador, por participante, y se rota en cada toma.
 */
const KEY = 'vaiinilla.mesa.dispositivo';
const MAX = 20;

type Store = Record<string, string>;

function read(): Store {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

export function tableDeviceToken(participantId: string): string | null {
  const value = read()[participantId];
  return typeof value === 'string' ? value : null;
}

export function saveTableDeviceToken(participantId: string, token: string): void {
  try {
    const store = read();
    delete store[participantId];
    store[participantId] = token;
    const keys = Object.keys(store);
    for (const old of keys.slice(0, Math.max(0, keys.length - MAX))) delete store[old];
    globalThis.localStorage?.setItem(KEY, JSON.stringify(store));
  } catch {
    // Sin almacenamiento: el participante se puede retomar con ayuda del mesero.
  }
}
