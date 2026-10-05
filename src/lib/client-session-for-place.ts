// Sesión de cliente para pedir en un lugar, sin duplicar: invitado (con nombre o
// anónimo para la mesa) o registrado con su contexto. La extrajo el flujo de mesa
// desde cart-page.tsx; cart-page y table-who-page la comparten.
import type { User } from 'firebase/auth';
import { api } from './api';
import { guestSession } from './guest-session';
import type { ClientContextResponse, PublicEstablishment } from '../types/api';

export async function clientSessionForPlace(input: {
  slug: string;
  place?: PublicEstablishment | null;
  user: User | null;
  context?: ClientContextResponse | null;
  openClientSession: (
    user: User,
    establishment: PublicEstablishment,
    identificadorCliente?: string,
  ) => Promise<ClientContextResponse>;
  /** Nombre del invitado; ausente = anónimo (para la mesa). */
  guestName?: string;
  clientId?: string;
}): Promise<ClientContextResponse> {
  const { slug, user, context, openClientSession, guestName, clientId } = input;
  let place = input.place ?? null;
  if (!user) return guestSession(slug, guestName);
  if (place && context?.contexto.establecimiento_id === place.id) return context;
  if (!place) place = await api.getEstablishment(slug);
  if (context?.contexto.establecimiento_id === place.id) return context;
  const storedId = clientId?.trim() || undefined;
  return openClientSession(user, place, storedId);
}
