// A new build waits as the "waiting" service worker (registerType 'prompt'), so it
// never swaps code under an open checkout. Normal updates apply in silence when it is
// safe (carrito vacío, sin envío ni pago en curso): al ocultar la pestaña, tras
// inactividad con carrito vacío, o al volver a /pedir. Builds marked `update.json`
// as importante show a toast; "Actualizar" llama SKIP_WAITING al instante.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  PWA_UPDATE_IDLE_MS,
  canSilentlyApplyServiceWorkerUpdate,
} from '../lib/pwa-update';

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
  const location = useLocation();

  const tryApplyPending = useCallback((options?: { requireHidden?: boolean }) => {
    const pending = pendingRef.current;
    if (!pending || appliedRef.current) return;
    if (options?.requireHidden && document.visibilityState !== 'hidden') return;
    if (!canSilentlyApplyServiceWorkerUpdate()) return;
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
        tryApplyPending({ requireHidden: true });
      });
    };
    const onFound = () => registration?.installing?.addEventListener('statechange', check);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') tryApplyPending({ requireHidden: true });
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
  }, [tryApplyPending]);

  useEffect(() => {
    if (location.pathname !== '/pedir') return;
    tryApplyPending();
  }, [location.pathname, tryApplyPending]);

  useEffect(() => {
    let idleTimer: number | undefined;
    const bumpIdle = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => tryApplyPending(), PWA_UPDATE_IDLE_MS);
    };
    bumpIdle();
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    for (const event of events) window.addEventListener(event, bumpIdle, { passive: true });
    return () => {
      window.clearTimeout(idleTimer);
      for (const event of events) window.removeEventListener(event, bumpIdle);
    };
  }, [tryApplyPending]);

  if (!important) return null;

  return (
    <div className="alumno-update" role="status">
      <span>Hay una versión nueva importante</span>
      <button type="button" onClick={() => important && activate(important)}>
        Actualizar
      </button>
    </div>
  );
}
