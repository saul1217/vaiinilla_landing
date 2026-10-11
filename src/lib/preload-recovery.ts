const RELOAD_FLAG = 'vite-preload-reloaded';

/** Minimum time between automatic reloads; inside this window we assume a loop. */
export const RELOAD_WINDOW_MS = 10_000;

function resolveStorage(target: Window): Storage | null {
  try {
    return target.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * After a deploy, an open tab may request JS chunks whose hashed names no
 * longer exist. Vite fires `vite:preloadError`; reload to pick up the new
 * build. The time of the last reload is stored so a tab left open through
 * several deploys recovers each time, while a reload that fails again within
 * RELOAD_WINDOW_MS is not repeated (no reload loops).
 */
export function installPreloadErrorRecovery(
  target: Window = window,
  storage: Storage | null = resolveStorage(target),
  now: () => number = Date.now,
): void {
  target.addEventListener('vite:preloadError', (event) => {
    const current = now();
    try {
      const last = Number(storage?.getItem(RELOAD_FLAG));
      if (Number.isFinite(last) && last > 0 && current - last < RELOAD_WINDOW_MS) {
        return;
      }
      storage?.setItem(RELOAD_FLAG, String(current));
    } catch {
      // Storage unavailable: still try a reload.
    }
    event.preventDefault();
    target.location.reload();
  });
}
