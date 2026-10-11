// Compra sin cuenta. El invitado solo da su nombre; el servidor le entrega una llave
// que se guarda aquí, en este dispositivo: es lo único que lo identifica. Con ella se
// renueva la sesión de cliente (15 min) para pedir otra ronda o pagar con tarjeta.
// Contrato: vaiinilla_back docs/compra-sin-cuenta.md.
import { api } from './api';
import { writeStoredClientContext } from './client-session';
import { readSpace } from './space-session';
import type { ClientContextResponse, GuestSessionResponse } from '../types/api';

const KEY = 'vaiinilla.buyer.guest.v1';

export interface StoredGuest {
  nombre: string;
  llave: string;
}

export function readGuest(): StoredGuest | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredGuest;
    return typeof parsed.llave === 'string' && typeof parsed.nombre === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

function saveGuest(guest: StoredGuest) {
  try {
    localStorage.setItem(KEY, JSON.stringify(guest));
  } catch {
    // Sin almacenamiento (modo privado): la sesión dura lo que la pestaña.
  }
}

// Prueba de escaneo del NFC/QR (QA-009): `entrada.token` llega con la sesión y vale hasta
// `vence_en`; mientras no llegue, la prueba es el `espacio_token` del QR escaneado.
const ENTRY_KEY = 'vaiinilla.buyer.guest.entry.v1';

interface StoredEntry {
  slug: string;
  token: string;
  venceEn: string | null;
}

function readEntry(slug: string): StoredEntry | null {
  try {
    const raw = localStorage.getItem(ENTRY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredEntry;
    if (parsed.slug !== slug || typeof parsed.token !== 'string') return null;
    if (parsed.venceEn && Date.parse(parsed.venceEn) <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function forgetGuestEntry() {
  try {
    localStorage.removeItem(ENTRY_KEY);
  } catch {
    // nada que borrar
  }
}

function saveEntry(slug: string, entrada: GuestSessionResponse['entrada']) {
  if (!entrada?.token) return;
  try {
    localStorage.setItem(ENTRY_KEY, JSON.stringify({ slug, token: entrada.token, venceEn: entrada.vence_en ?? null }));
  } catch {
    // Sin almacenamiento: la prueba dura lo que la pestaña.
  }
}

function entryProof(slug: string): { espacioToken?: string; entradaToken?: string } {
  const entry = readEntry(slug);
  if (entry) return { entradaToken: entry.token };
  const scanned = readSpace(slug)?.qrToken;
  return scanned && scanned.startsWith('esp_') ? { espacioToken: scanned } : {};
}

export function forgetGuest() {
  forgetGuestEntry();
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nada que borrar
  }
}

/**
 * Una sesión de cliente para el invitado en este negocio: renueva con la llave
 * guardada; si no hay llave (o ya no sirve, o cambió el nombre) da de alta otra.
 * Sin nombre usa/renueva la llave y crea un invitado anónimo si no hay (para la
 * mesa: lo visible es el alias del participante, no el del invitado).
 */
export async function guestSession(
  slug: string,
  nombre?: string,
  options: { espacioToken?: string } = {},
): Promise<ClientContextResponse> {
  const stored = readGuest();
  const proof = options.espacioToken ? { espacioToken: options.espacioToken } : entryProof(slug);
  const clean = (nombre ?? '').trim().replace(/\s+/g, ' ');
  if (stored && (clean === '' || stored.nombre === clean)) {
    try {
      const renewed = await api.renewGuest(slug, stored.llave, proof);
      saveEntry(slug, renewed.entrada);
      writeStoredClientContext(renewed, slug);
      return renewed;
    } catch {
      // La llave ya no sirve: se da de alta de nuevo.
    }
  }
  const legal = await api.getLegalVersions();
  const created = await api.createGuest({
    slug,
    ...(clean === '' ? {} : { nombre: clean }),
    terminosVersion: legal.terminos_version,
    privacidadVersion: legal.privacidad_version,
    ...proof,
  });
  saveEntry(slug, created.entrada);
  if (created.invitado.llave) saveGuest({ nombre: created.invitado.nombre, llave: created.invitado.llave });
  writeStoredClientContext(created, slug);
  return created;
}
