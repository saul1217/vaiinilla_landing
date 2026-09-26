// A new build waits as the "waiting" service worker (registerType 'prompt'), so
// it never swaps code under an open checkout. This toast lets the buyer take it.
import { useEffect, useState } from 'react';

export function UpdateToast() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    const sw = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker;
    if (!sw) return;
    let registration: ServiceWorkerRegistration | undefined;
    const check = () => {
      if (registration?.waiting && sw.controller) setWaiting(registration.waiting);
    };
    const onFound = () => {
      const incoming = registration?.installing;
      incoming?.addEventListener('statechange', check);
    };
    void sw.getRegistration().then((found) => {
      registration = found;
      check();
      registration?.addEventListener('updatefound', onFound);
    });
    const onFocus = () => void registration?.update().catch(() => {});
    window.addEventListener('focus', onFocus);
    return () => {
      registration?.removeEventListener('updatefound', onFound);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  if (!waiting) return null;

  const apply = () => {
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
    waiting.postMessage({ type: 'SKIP_WAITING' });
  };

  return (
    <div className="alumno-update" role="status">
      <span>Hay una versión nueva</span>
      <button type="button" onClick={apply}>
        Actualizar
      </button>
    </div>
  );
}
