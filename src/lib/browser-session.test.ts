import { beforeEach, describe, expect, it } from 'vitest';
import {
  beginBrowserSession,
  BUYER_BROWSER_SESSION_MAX_AGE_SEC,
  endBrowserSession,
  hasBrowserSession,
  touchBrowserSession,
} from './browser-session';

const COOKIE = 'vaiinilla_buyer_browser_session';

describe('browser session cookie', () => {
  beforeEach(() => {
    endBrowserSession();
  });

  it('dura 30 días y sobrevive un refresh del Max-Age', () => {
    expect(BUYER_BROWSER_SESSION_MAX_AGE_SEC).toBe(60 * 60 * 24 * 30);
    beginBrowserSession();
    expect(hasBrowserSession()).toBe(true);
    expect(document.cookie).toContain(COOKIE);
    touchBrowserSession();
    expect(hasBrowserSession()).toBe(true);
    endBrowserSession();
    expect(hasBrowserSession()).toBe(false);
  });
});
