export type UnauthorizedListener = (info: { pathname: string }) => void;

const unauthorizedListeners = new Set<UnauthorizedListener>();

export function onUnauthorizedSession(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

export function notifyUnauthorized(): void {
  if (typeof window === 'undefined') return;
  const pathname = window.location.pathname + window.location.search;
  unauthorizedListeners.forEach((listener) => {
    try {
      listener({ pathname });
    } catch {
      // ignore
    }
  });
}
