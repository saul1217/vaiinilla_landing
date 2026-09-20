import { enableGuestExplore } from './guest-explore';
import { lastPlaceSlug } from './last-place';

/** Path into the buyer app: last cafeteria, otherwise the public campus picker. */
export function buyerEntryPath(cartSlug?: string | null): string {
  const slug = cartSlug || lastPlaceSlug();
  return slug ? `/e/${slug}` : '/pedir';
}

/** Guest explore so /pedir opens the picker instead of the login splash. */
export function markBuyerExplore(): void {
  enableGuestExplore();
}
