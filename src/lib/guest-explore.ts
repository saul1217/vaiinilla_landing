const EXPLORE_KEY = 'vaiinilla.buyer.guest-explore.v1';
const BUY_KEY = 'vaiinilla.buyer.guest-buy.v1';

export function isGuestExplore(): boolean {
  return sessionStorage.getItem(EXPLORE_KEY) === '1';
}

export function enableGuestExplore(): void {
  sessionStorage.setItem(EXPLORE_KEY, '1');
}

export function disableGuestExplore(): void {
  sessionStorage.removeItem(EXPLORE_KEY);
}

export function isGuestBuy(): boolean {
  return sessionStorage.getItem(BUY_KEY) === '1';
}

export function enableGuestBuy(): void {
  sessionStorage.setItem(BUY_KEY, '1');
  enableGuestExplore();
}

export function disableGuestBuy(): void {
  sessionStorage.removeItem(BUY_KEY);
}
