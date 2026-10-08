import { lastPlaceSlug } from './last-place';
const KEY = 'vaiinilla.buyer.space.v1';
/** Una mesa escaneada vale por una visita: pasado esto se pide escanear otra vez. */
const SPACE_TTL_MS = 4 * 60 * 60 * 1000;

export interface SpaceSession {
  slug: string;
  espacioId: number;
  nombre: string;
  /** mesa, cancha, asiento… Ausente en sesiones guardadas antes de este campo. */
  tipo?: string;
  /** El cliente ya eligió pagar al final en esta mesa: la siguiente ronda arranca igual. */
  pagaAlFinal?: boolean;
  /** Código del QR escaneado: con él el cliente se une a la mesa compartida. */
  qrToken?: string;
  /** Id de la sesión que se confirmó en backend; separa rondas en la misma mesa. */
  sesionId?: string;
}

interface StoredSpace extends SpaceSession {
  guardadoEn?: number;
}

// En el dispositivo y no en la pestaña: el QR abre el navegador, la app instalada es otro
// contexto y el teléfono puede cerrar la app al ir a Google a entrar. La mesa debe seguir ahí.
function readStored(): StoredSpace | null {
  try {
    const raw = localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSpace;
    if (!parsed.slug || !Number.isFinite(parsed.espacioId)) return null;
    if (parsed.guardadoEn !== undefined && Date.now() - parsed.guardadoEn > SPACE_TTL_MS) {
      forgetSpace();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function withoutStamp(stored: StoredSpace): SpaceSession {
  const space: StoredSpace = { ...stored };
  delete space.guardadoEn;
  return space;
}

export function readSpace(slug: string): SpaceSession | null {
  const stored = readStored();
  return stored && stored.slug === slug ? withoutStamp(stored) : null;
}

/** La mesa escaneada vigente en cualquier negocio: para volver a ella al reabrir la app. */
export function scannedSpace(): SpaceSession | null {
  const stored = readStored();
  return stored ? withoutStamp(stored) : null;
}

export function rememberSpace(session: SpaceSession): void {
  const stored: StoredSpace = { ...session, guardadoEn: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    sessionStorage.setItem(KEY, JSON.stringify(stored));
  }
}

export function forgetSpace(): void {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    // nada que borrar
  }
}

/** Tras entrar o elegir comprar sin cuenta, quien escaneó una mesa vuelve a su menú, no al selector. */
export function entryAfterAccess(next: string): string {
  if (next !== '/pedir') return next;
  const space = scannedSpace();
  return space ? `/e/${space.slug}` : next;
}

const ACCOUNT_ONLY_PATHS = [/^\/cuenta\/saldo\/?$/, /^\/cuenta\/pedidos\/[^/]+\/?$/, /^\/u\/[^/]+\/?$/];

/** Rutas que no existen sin cuenta: mandar ahí a un invitado lo regresa al splash. */
export function requiresAccount(path: string): boolean {
  const pathname = path.split(/[?#]/)[0] ?? path;
  return ACCOUNT_ONLY_PATHS.some((pattern) => pattern.test(pathname));
}

/** El menú al que vuelve quien no quiere cuenta: la mesa, el último lugar o el selector. */
export function guestMenuPath(next: string): string {
  const fromNext = /^\/e\/([^/?#]+)/.exec(next)?.[1];
  const slug = fromNext ?? scannedSpace()?.slug ?? lastPlaceSlug();
  return slug ? `/e/${slug}` : '/pedir';
}

/** Comprar sin cuenta: sigue a `next` salvo que esa ruta pida cuenta. */
export function guestEntryAfterAccess(next: string): string {
  return requiresAccount(next) ? guestMenuPath(next) : entryAfterAccess(next);
}

/** Lo mínimo de una renta para saber si el cliente está jugando ahora en una cancha. */
export interface RentalLike {
  courtId: number;
  courtName: string | null;
  start: number;
  end: number;
  state: string;
}

/**
 * La cancha que el cliente tiene rentada ahora mismo en este negocio, como si hubiera
 * escaneado su QR: así la comida va a la cancha sin volver a escanear. Rentar no pasa
 * por el QR, y el espacio escaneado solo vive en la pestaña.
 */
export function activeRentalSpace(slug: string, rentals: RentalLike[], now: number): SpaceSession | null {
  const playing = rentals
    .filter((r) => (r.state === 'confirmada' || r.state === 'en_curso') && r.start <= now && now < r.end)
    .sort((a, b) => b.start - a.start)[0];
  if (!playing) return null;
  return { slug, espacioId: playing.courtId, nombre: playing.courtName ?? 'Tu cancha', tipo: 'cancha' };
}
