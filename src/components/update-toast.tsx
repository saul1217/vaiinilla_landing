// A new build waits as the "waiting" service worker (registerType 'prompt'), so it
// never swaps code under an open checkout. Updates apply only while the tab is hidden
// (SKIP_WAITING + reload on controllerchange). Normal updates do so in silence;
// builds marked `public/update.json` as importante show a toast but still wait for
// a hidden tab — never mid-checkout, including the "Actualizar" button.
import { useCallback, useEffect, useRef, useState } from 'react';

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
  const pendingRef = useRef<ServiceWorker | null>(null);
  const appliedRef = useRef(false);

  const applyIfHidden = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending || appliedRef.current || document.visibilityState !== 'hidden') return;
    appliedRef.current = true;
    activate(pending);
  }, []);

  useEffect(() => {
    const sw = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker;
    if (!sw) return;
    let registration: ServiceWorkerRegistration | undefined;
    let seen: ServiceWorker | null = null;

    const check = () => {
      const waiting = registration?.waiting;
      if (!waiting || !sw.controller || waiting === seen) return;
      seen = waiting;
      void isImportant().then((yes) => {
        pendingRef.current = waiting;
        if (yes) setImportant(waiting);
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
  }, [applyIfHidden]);

  if (!important) return null;

  return (
    <div className="alumno-update" role="status">
      <span>Hay una versión nueva importante</span>
      <button type="button" onClick={() => applyIfHidden()}>
        Actualizar
      </button>
    </div>
  );
}
