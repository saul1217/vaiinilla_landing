import { useCallback, useEffect, useState } from 'react';

/**
 * Instalación de la PWA. El navegador avisa una sola vez (`beforeinstallprompt`);
 * se captura y se ofrece en contexto: recién pedido, cuando seguir el pedido sin
 * guardar enlaces tiene sentido. Si falla o se descarta, no se insiste.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'vaiinilla.buyer.pwa-install-dismissed.v1';

let deferredPrompt: BeforeInstallPromptEvent | null = null;

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return true;
  }
}

/** Ya instalada: corre en standalone (o modo iOS equivalente). */
export function isPwaInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches
  ) {
    return true;
  }
  return (window.navigator as { standalone?: boolean }).standalone === true;
}

export function usePwaInstall() {
  const [ready, setReady] = useState(() => deferredPrompt !== null);
  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      deferredPrompt = event as BeforeInstallPromptEvent;
      setReady(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        deferredPrompt = null;
        setReady(false);
      }
    } catch {
      // El navegador manda: queda el enlace de seguimiento.
    }
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Sin almacenamiento no se recuerda: tampoco se insiste en esta sesión.
    }
    setDismissed(true);
  }, []);

  return { offer: ready && !dismissed && !isPwaInstalled(), install, dismiss };
}
