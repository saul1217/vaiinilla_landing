// Compra sin cuenta. El invitado solo da su nombre; el servidor le entrega una llave
// que se guarda aquí, en este dispositivo: es lo único que lo identifica. Con ella se
// renueva la sesión de cliente (15 min) para pedir otra ronda o pagar con tarjeta.
// Contrato: vaiinilla_back docs/compra-sin-cuenta.md.
import { api } from './api';
import { writeStoredClientContext } from './client-session';
import type { ClientContextResponse } from '../types/api';

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

export function forgetGuest() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nada que borrar
  }
}

/**
 * Una sesión de cliente para el invitado en este negocio: renueva con la llave
 * guardada; si no hay llave (o ya no sirve, o cambió el nombre) da de alta otra.
 */
export async function guestSession(slug: string, nombre: string): Promise<ClientContextResponse> {
  const stored = readGuest();
  const clean = nombre.trim().replace(/\s+/g, ' ');
  if (stored && stored.nombre === clean) {
    try {
      const renewed = await api.renewGuest(slug, stored.llave);
      writeStoredClientContext(renewed, slug);
      return renewed;
    } catch {
      // La llave ya no sirve: se da de alta de nuevo.
    }
  }
  const legal = await api.getLegalVersions();
  const created = await api.createGuest({
    slug,
    nombre: clean,
    terminosVersion: legal.terminos_version,
    privacidadVersion: legal.privacidad_version,
  });
  if (created.invitado.llave) saveGuest({ nombre: created.invitado.nombre, llave: created.invitado.llave });
  writeStoredClientContext(created, slug);
  return created;
}
