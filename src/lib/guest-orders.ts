// Los enlaces de seguimiento de los pedidos de invitado, guardados en este navegador
// para que al volver vea "Tu pedido en curso". No sustituye al enlace: en otro
// dispositivo o al borrar datos del navegador, solo el enlace sirve.

const KEY = 'vaiinilla.buyer.guest-orders.v1';
const MAX = 10;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface GuestOrderLink {
  token: string;
  slug: string;
  folio: number;
  placeName: string;
  createdAt: number;
  /** Evita tratar los enlaces de una mesa como pedidos individuales activos. */
  sessionId?: string;
  destination?: 'en_espacio' | 'para_llevar';
}

export function tagGuestOrderSession(token: string, sessionId: string): void {
  try {
    const next = readGuestOrders().map((order) =>
      order.token === token ? { ...order, sessionId } : order,
    );
    localStorage.setItem(KEY, JSON.stringify(next.slice(0, MAX)));
  } catch {
    // El vínculo de seguimiento sigue disponible aunque no se pueda etiquetar localmente.
  }
}

export function forgetGuestOrdersForSession(sessionId: string): void {
  try {
    const rest = readGuestOrders().filter((order) => order.sessionId !== sessionId);
    localStorage.setItem(KEY, JSON.stringify(rest.slice(0, MAX)));
  } catch {
    // El token de soporte no se invalida en backend.
  }
}

export function trackingPath(token: string): string {
  return `/seguimiento/${token}`;
}

export function trackingUrl(token: string): string {
  return `${window.location.origin}${trackingPath(token)}`;
}

export function readGuestOrders(now = Date.now()): GuestOrderLink[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as GuestOrderLink[]) : [];
    return list.filter((o) => typeof o.token === 'string' && now - o.createdAt < MAX_AGE_MS);
  } catch {
    return [];
  }
}

export function rememberGuestOrder(link: GuestOrderLink): void {
  try {
    const rest = readGuestOrders().filter((o) => o.token !== link.token);
    localStorage.setItem(KEY, JSON.stringify([link, ...rest].slice(0, MAX)));
  } catch {
    // Sin almacenamiento: queda solo el enlace.
  }
}

/** Tras reclamar a la cuenta, los enlaces de esos negocios ya viven ahí. */
export function forgetGuestOrdersBySlugs(slugs: string[]): void {
  if (slugs.length === 0) return;
  try {
    const rest = readGuestOrders().filter((o) => !slugs.includes(o.slug));
    localStorage.setItem(KEY, JSON.stringify(rest.slice(0, MAX)));
  } catch {
    // Nada que borrar.
  }
}
