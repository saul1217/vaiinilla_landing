const KEY = 'vaiinilla.buyer.guest-explore.v1';

export function isGuestExplore(): boolean {
  return sessionStorage.getItem(KEY) === '1';
}

export function enableGuestExplore(): void {
  sessionStorage.setItem(KEY, '1');
}

export function disableGuestExplore(): void {
  sessionStorage.removeItem(KEY);
}
