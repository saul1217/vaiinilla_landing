const KEY = 'vaiinilla.buyer.space.v1';

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
}

export function readSpace(slug: string): SpaceSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SpaceSession;
    if (parsed.slug !== slug || !Number.isFinite(parsed.espacioId)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function rememberSpace(session: SpaceSession): void {
  sessionStorage.setItem(KEY, JSON.stringify(session));
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
