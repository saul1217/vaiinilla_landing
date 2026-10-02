// A new build waits as the "waiting" service worker (registerType 'prompt'), so it
// never swaps code under an open checkout. Normal updates apply in silence: the new
// worker takes over only while the tab is hidden, and the hidden tab reloads, so the
// buyer comes back to the new version without seeing anything. Only a build that
// marks `public/update.json` as importante (a change that breaks the old version)
// shows the toast.
import { useEffect, useState } from 'react';

async function isImportant(): Promise<boolean> {
  try {
    const res = await fetch('/update.json', { cache: 'no-store' });
    if (!res.ok) return false;
    const body = (await res.json()) as { importante?: unknown };
    return body.importante === true;
  } catch {
    return false;
  }
}

function activate(waiting: ServiceWorker) {
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  waiting.postMessage({ type: 'SKIP_WAITING' });
}

export function UpdateToast() {
  const [important, setImportant] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    const sw = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker;
    if (!sw) return;
    let registration: ServiceWorkerRegistration | undefined;
    let seen: ServiceWorker | null = null;
    let pending: ServiceWorker | null = null;
    let applied = false;

    const applyIfHidden = () => {
      if (!pending || applied || document.visibilityState !== 'hidden') return;
      applied = true;
      activate(pending);
    };
    const check = () => {
      const waiting = registration?.waiting;
      if (!waiting || !sw.controller || waiting === seen) return;
      seen = waiting;
      void isImportant().then((yes) => {
        if (yes) {
          setImportant(waiting);
          return;
        }
        pending = waiting;
        applyIfHidden();
      });
    };
    const onFound = () => registration?.installing?.addEventListener('statechange', check);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') applyIfHidden();
      else void registration?.update().catch(() => {});
    };

    void sw.getRegistration().then((found) => {
      registration = found;
      check();
      registration?.addEventListener('updatefound', onFound);
    });
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      registration?.removeEventListener('updatefound', onFound);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  if (!important) return null;

  return (
    <div className="alumno-update" role="status">
      <span>Hay una versión nueva importante</span>
      <button type="button" onClick={() => activate(important)}>
        Actualizar
      </button>
    </div>
  );
}
