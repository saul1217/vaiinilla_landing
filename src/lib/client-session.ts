import type { User } from 'firebase/auth';
import { api } from './api';
import { firebaseIdToken } from './firebase';
import { lastPlaceSlug, rememberPlace } from './last-place';
import type { ClientContextResponse, PublicEstablishment, SessionAccess } from '../types/api';

const STORAGE_KEY = 'vaiinilla.buyer.client-context.v1';
const EXPIRY_SKEW_MS = 30_000;

export interface StoredClientContext {
  context: ClientContextResponse;
  slug: string | null;
  expiresAt: number;
}

export interface ResolvedClientSession {
  context: ClientContextResponse;
  slug: string | null;
  place: PublicEstablishment | null;
}

export function pickClientAccess(
  accesses: SessionAccess[],
  preferredSlug?: string | null,
): SessionAccess | null {
  const clients = accesses.filter(
    (access) => access.rol === 'cliente' && access.estado_establecimiento === 'activo',
  );
  if (preferredSlug) {
    const match = clients.find((access) => access.establecimiento.slug === preferredSlug);
    if (match) return match;
  }
  return clients[0] ?? null;
}

export function readStoredClientContext(): StoredClientContext | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredClientContext;
    if (!parsed?.context?.access_token) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (typeof parsed.expiresAt === 'number' && Date.now() >= parsed.expiresAt) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeStoredClientContext(context: ClientContextResponse, slug: string | null): void {
  const ttlMs = Math.max(0, (context.expires_in ?? 0) * 1000 - EXPIRY_SKEW_MS);
  const record: StoredClientContext = {
    context,
    slug,
    expiresAt: ttlMs > 0 ? Date.now() + ttlMs : Date.now() + 55 * 60 * 1000,
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

export function clearStoredClientContext(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export async function resolveClientSession(input: {
  user: User;
  context: ClientContextResponse | null;
  preferredSlug?: string | null;
  openClientSession: (
    user: User,
    establishment: PublicEstablishment,
    identificadorCliente?: string,
  ) => Promise<ClientContextResponse>;
}): Promise<ResolvedClientSession | null> {
  const preferredSlug = input.preferredSlug || lastPlaceSlug();
  if (preferredSlug) {
    const place = await api.getEstablishment(preferredSlug);
    if (input.context && input.context.contexto.establecimiento_id === place.id) {
      rememberPlace(place.slug);
      return { context: input.context, slug: place.slug, place };
    }
    const context = await input.openClientSession(input.user, place);
    rememberPlace(place.slug);
    return { context, slug: place.slug, place };
  }

  if (input.context) {
    return { context: input.context, slug: lastPlaceSlug(), place: null };
  }

  const firebaseToken = await firebaseIdToken(input.user);
  const accesses = await api.listAccesses(firebaseToken);
  const access = pickClientAccess(accesses);
  if (!access) return null;
  const place = await api.getEstablishment(access.establecimiento.slug);
  const context = await input.openClientSession(input.user, place);
  rememberPlace(place.slug);
  return { context, slug: place.slug, place };
}
