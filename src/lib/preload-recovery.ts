const RELOAD_FLAG = 'vite-preload-reloaded';

/**
 * After a deploy, an open tab may request JS chunks whose hashed names no
 * longer exist. Vite fires `vite:preloadError`; reload once to pick up the
 * new build. The sessionStorage flag prevents reload loops.
 */
export function installPreloadErrorRecovery(
  target: Window = window,
  storage: Storage = target.sessionStorage,
): void {
  target.addEventListener('vite:preloadError', (event) => {
    let alreadyReloaded = false;
    try {
      alreadyReloaded = storage.getItem(RELOAD_FLAG) === '1';
      if (!alreadyReloaded) storage.setItem(RELOAD_FLAG, '1');
    } catch {
      // Storage unavailable: still try a single reload per page load.
    }
    if (alreadyReloaded) return;
    event.preventDefault();
    target.location.reload();
  });
}
