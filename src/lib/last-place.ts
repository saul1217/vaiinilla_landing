const KEY = 'vaiinilla.buyer.last-place.v1';

export function rememberPlace(slug: string): void {
  sessionStorage.setItem(KEY, slug);
}

export function lastPlaceSlug(): string | null {
  return sessionStorage.getItem(KEY);
}
