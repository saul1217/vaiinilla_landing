import { describe, expect, it, vi } from 'vitest';
import { installPreloadErrorRecovery } from './preload-recovery';

function setup() {
  const reload = vi.fn();
  const target = new EventTarget() as unknown as Window;
  Object.assign(target, { location: { reload } });
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  } as unknown as Storage;
  installPreloadErrorRecovery(target, storage);
  return { reload, target };
}

describe('installPreloadErrorRecovery', () => {
  it('reloads once on vite:preloadError', () => {
    const { reload, target } = setup();
    target.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));
    target.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
