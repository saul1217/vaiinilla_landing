import type { User } from 'firebase/auth';
import { api } from './api';
import { firebaseIdToken } from './firebase';
import { forgetGuest, readGuest } from './guest-session';
import { forgetGuestOrdersBySlugs, readGuestOrders } from './guest-orders';
import type { ClaimGuestOrdersResponse } from '../types/api';

/**
 * Reclamo invitado → cuenta ("estos pedidos eran míos").
 *
 * Hay algo que reclamar cuando este navegador guarda llave de invitado y al
 * menos un enlace de seguimiento. Tras reclamar, la llave se olvida (queda
 * vacía en el servidor) y los enlaces de esos negocios se podan: ya viven en
 * la cuenta. El enlace sigue válido como respaldo público.
 */
export function hasClaimableGuestOrders(): boolean {
  return readGuest() !== null && readGuestOrders().length > 0;
}

export async function claimGuestOrders(user: User): Promise<ClaimGuestOrdersResponse | null> {
  const guest = readGuest();
  if (!guest) return null;
  const out = await api.claimGuestOrders(await firebaseIdToken(user), guest.llave);
  forgetGuest();
  forgetGuestOrdersBySlugs(out.reclamado.establecimientos);
  return out;
}
