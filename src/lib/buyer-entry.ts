import { enableGuestExplore } from './guest-explore';
import { scannedSpace } from './space-session';

/**
 * Path into the buyer app: the store of an order in progress (cart or scanned table),
 * otherwise the picker, which asks for the QR or code. With several stores, a store
 * visited before is never assumed.
 */
export function buyerEntryPath(activeSlug?: string | null): string {
  const slug = activeSlug || scannedSpace()?.slug;
  return slug ? `/e/${slug}` : '/pedir';
}

/** Guest explore so /pedir opens the picker instead of the login splash. */
export function markBuyerExplore(): void {
  enableGuestExplore();
}
