const SESSION_COOKIE = 'vaiinilla_buyer_browser_session';

function cookieAttributes(): string {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  return `Path=/; SameSite=Lax${secure}`;
}

function readCookie(name: string): string | null {
  const prefix = `${encodeURIComponent(name)}=`;
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  if (!match) return null;
  return decodeURIComponent(match.slice(prefix.length));
}

export function beginBrowserSession(): void {
  if (!readCookie(SESSION_COOKIE)) {
    document.cookie = `${encodeURIComponent(SESSION_COOKIE)}=${encodeURIComponent(crypto.randomUUID())}; ${cookieAttributes()}`;
  }
}

export function hasBrowserSession(): boolean {
  return Boolean(readCookie(SESSION_COOKIE));
}

export function endBrowserSession(): void {
  document.cookie = `${encodeURIComponent(SESSION_COOKIE)}=; ${cookieAttributes()}; Max-Age=0`;
}
