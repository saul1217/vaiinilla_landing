import { clearCart, readCart, writeCart } from './cart-storage';
import { forgetGuestOrdersForSession } from './guest-orders';
import { forgetSpace, readSpace, rememberSpace, type SpaceSession } from './space-session';
import { forgetTableParticipant, readTableParticipant } from './table-participant';

function invalidateCart(slug: string, sessionId: string | null, spaceId: number): void {
  window.dispatchEvent(new CustomEvent('vaiinilla:table-cart-invalidated', {
    detail: { slug, sessionId, spaceId },
  }));
}

/** Sincroniza la sesión confirmada por el servidor y descarta artefactos de la sesión anterior. */
export function observeTableSession(
  nextSessionId: string,
  space: SpaceSession,
): boolean {
  const identity = readTableParticipant();
  const storedSpace = readSpace(space.slug);
  const cart = readCart();
  const oldSessionIds = new Set(
    [identity?.slug === space.slug && identity.espacioId === space.espacioId ? identity.sesionId : null,
      storedSpace?.espacioId === space.espacioId ? storedSpace.sesionId : null,
      cart?.slug === space.slug ? cart.sessionId : null]
      .filter((id): id is string => Boolean(id) && id !== nextSessionId),
  );
  for (const sessionId of oldSessionIds) forgetGuestOrdersForSession(sessionId);
  if (identity && (identity.slug !== space.slug || identity.espacioId !== space.espacioId || identity.sesionId !== nextSessionId)) {
    forgetTableParticipant();
  }
  if (cart?.slug === space.slug) {
    if ((cart.sessionId && cart.sessionId !== nextSessionId) || (oldSessionIds.size > 0 && cart.sessionId !== nextSessionId)) {
      invalidateCart(space.slug, cart.sessionId ?? [...oldSessionIds][0] ?? null, space.espacioId);
      clearCart();
    }
    else writeCart({ ...cart, sessionId: nextSessionId, spaceId: space.espacioId });
  }
  const next: SpaceSession = {
    ...storedSpace,
    ...space,
    sesionId: nextSessionId,
  };
  rememberSpace(next);
  return Boolean(cart?.slug === space.slug && ((cart.sessionId && cart.sessionId !== nextSessionId) || (oldSessionIds.size > 0 && cart.sessionId !== nextSessionId)));
}

/** Al cerrar/abandonar la mesa, limpia solo el contexto local de esa estancia. */
export function clearClosedTableSession(slug?: string, spaceId?: number): void {
  const identity = readTableParticipant();
  const storedSpace = slug ? readSpace(slug) : null;
  const cart = readCart();
  const oldSessionId = identity && (!slug || identity.slug === slug) && (!spaceId || identity.espacioId === spaceId)
    ? identity.sesionId
    : storedSpace?.sesionId ?? (cart && cart.slug === slug ? cart.sessionId ?? null : null);
  // `currentTable` also returns null when this browser has never joined a table.
  // Do not touch storage unless we know which session ended.
  if (!oldSessionId) return;
  if (oldSessionId) forgetGuestOrdersForSession(oldSessionId);
  if (identity && (!slug || identity.slug === slug) && (!spaceId || identity.espacioId === spaceId)) {
    forgetTableParticipant();
  }
  if (
    cart &&
    (!slug || cart.slug === slug) &&
    (cart.sessionId === oldSessionId || (!cart.sessionId && spaceId != null && cart.spaceId === spaceId))
  ) {
    if (slug && cart.spaceId != null) invalidateCart(slug, cart.sessionId ?? null, cart.spaceId);
    clearCart();
  }
  if (
    storedSpace &&
    (!spaceId || storedSpace.espacioId === spaceId) &&
    (storedSpace.sesionId === oldSessionId || (!storedSpace.sesionId && identity?.sesionId === oldSessionId))
  ) {
    forgetSpace();
  }
}
