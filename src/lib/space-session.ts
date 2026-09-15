const KEY = 'vaiinilla.buyer.space.v1';

export interface SpaceSession {
  slug: string;
  espacioId: number;
  nombre: string;
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

export function clearSpace(): void {
  sessionStorage.removeItem(KEY);
}
