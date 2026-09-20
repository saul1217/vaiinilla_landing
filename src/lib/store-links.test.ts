import { describe, expect, it } from 'vitest';
import { appStoreUrl, playStoreUrl, storeHref } from './store-links';

describe('store-links', () => {
  it('queda vacío hasta que haya ficha oficial', () => {
    expect(playStoreUrl).toBe('');
    expect(appStoreUrl).toBe('');
    expect(storeHref('play')).toBeNull();
    expect(storeHref('apple')).toBeNull();
  });
});
