const SESSION_COOKIE = 'vaiinilla_buyer_browser_session';

export const BUYER_BROWSER_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;

function cookieAttributes(): string {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  return `Path=/; SameSite=Lax; Max-Age=${BUYER_BROWSER_SESSION_MAX_AGE_SEC}${secure}`;
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

function writeSessionCookie(value: string): void {
  document.cookie = `${encodeURIComponent(SESSION_COOKIE)}=${encodeURIComponent(value)}; ${cookieAttributes()}`;
}

export function beginBrowserSession(): void {
  writeSessionCookie(readCookie(SESSION_COOKIE) ?? crypto.randomUUID());
}

export function touchBrowserSession(): void {
  const value = readCookie(SESSION_COOKIE);
  if (value) writeSessionCookie(value);
}

export function hasBrowserSession(): boolean {
  return Boolean(readCookie(SESSION_COOKIE));
}

export function endBrowserSession(): void {
  document.cookie = `${encodeURIComponent(SESSION_COOKIE)}=; ${cookieAttributes()}; Max-Age=0`;
}
