const KEY = 'vaiinilla.buyer.last-place.v1';

export function rememberPlace(slug: string): void {
  localStorage.setItem(KEY, slug);
  sessionStorage.setItem(KEY, slug);
}

export function forgetPlace(): void {
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
}

export function lastPlaceSlug(): string | null {
  return localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
}
