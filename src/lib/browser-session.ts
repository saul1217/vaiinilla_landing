const SESSION_COOKIE = 'vaiinilla_buyer_browser_session';

const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function cookieAttributes(): string {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  return `Path=/; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secure}`;
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
