// Entrar a un lugar desde la ventana "Escanear QR · Código · NFC": lo que se lee (un
// enlace de QR o NFC, o el código de 4 dígitos de la mesa) se convierte en a dónde ir.
import { api } from './api';
import { rememberPlace } from './last-place';
import { forgetGuestEntry, guestSession } from './guest-session';
import { rememberSpace } from './space-session';

export type EntryTarget = { kind: 'space'; token: string } | { kind: 'store'; slug: string };

const CODE = /^[0-9]{4,8}$/;
const SLUG = /^[a-z0-9-]+$/i;

/**
 * Lo leído en un QR o una etiqueta: el enlace de una mesa (`/<negocio>/m/<token>` o
 * `/e/<negocio>/m/<token>`), el de la tienda (`/e/<negocio>`) o un código suelto.
 * Cualquier otra cosa no es de Vaiinilla y se rechaza.
 */
export function parseEntry(text: string): EntryTarget | null {
  const raw = text.trim();
  if (CODE.test(raw)) return { kind: 'space', token: raw };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!/(^|\.)vaiinilla\.app$/.test(url.hostname) && url.hostname !== window.location.hostname) return null;
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const [first, second, third] = parts[0] === 'e' ? parts.slice(1) : parts;
  const shape = parts[0] === 'e' ? parts.length - 1 : parts.length;
  if (shape === 3 && first && second === 'm' && third && SLUG.test(first)) return { kind: 'space', token: third };
  const store = parts[1];
  if (parts[0] === 'e' && parts.length === 2 && store && SLUG.test(store)) return { kind: 'store', slug: store };
  return null;
}

/**
 * Resuelve la mesa (por token de QR o por código), la guarda para el pedido y lleva al
 * menú. La cuenta se ofrece hasta pagar, no al sentarse.
 */
export async function enterSpace(
  token: string,
  slugHint?: string,
): Promise<{ destination: string; tipo: string | null; nombre: string }> {
  const resolved = await api.resolveSpace(token, slugHint);
  rememberPlace(resolved.establecimiento_slug);
  rememberSpace({
    slug: resolved.establecimiento_slug,
    espacioId: resolved.espacio_id,
    nombre: resolved.espacio_nombre,
    tipo: resolved.espacio_tipo ?? undefined,
    // El backend acepta el token o el código para unirse a la mesa compartida.
    qrToken: token,
  });
  // El escaneo es la única ocasión en que se manda el espacio_token: crea o renueva la
  // sesión de invitado con él. Después solo se usa la entrada que devuelve el servidor.
  if (token.startsWith('esp_')) {
    forgetGuestEntry();
    await guestSession(resolved.establecimiento_slug, undefined, { espacioToken: token }).catch(() => undefined);
  }
  return {
    destination: `/e/${resolved.establecimiento_slug}`,
    tipo: resolved.espacio_tipo,
    nombre: resolved.espacio_nombre,
  };
}

export function storeDestination(slug: string): string {
  rememberPlace(slug);
  return `/e/${slug}`;
}
