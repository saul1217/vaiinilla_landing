import { describe, expect, it, vi } from 'vitest';
import { RELOAD_WINDOW_MS, installPreloadErrorRecovery } from './preload-recovery';

function setup(storageOverride?: Storage | null) {
  const reload = vi.fn();
  const target = new EventTarget() as unknown as Window;
  Object.assign(target, { location: { reload } });
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  } as unknown as Storage;
  let time = 1_000_000;
  installPreloadErrorRecovery(
    target,
    storageOverride === undefined ? storage : storageOverride,
    () => time,
  );
  const fire = () => target.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));
  return { reload, fire, advance: (ms: number) => void (time += ms) };
}

describe('installPreloadErrorRecovery', () => {
  it('reloads once for two events within the window', () => {
    const { reload, fire, advance } = setup();
    fire();
    advance(RELOAD_WINDOW_MS - 1);
    fire();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads again after the window has passed (second deploy)', () => {
    const { reload, fire, advance } = setup();
    fire();
    advance(RELOAD_WINDOW_MS + 1);
    fire();
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('does not throw and still reloads when storage throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    } as unknown as Storage;
    const { reload, fire } = setup(broken);
    expect(() => fire()).not.toThrow();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('works when sessionStorage is unavailable', () => {
    const { reload, fire } = setup(null);
    fire();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
