const KEY = 'vaiinilla.buyer.last-place.v1';

// Tras "Cambiar tienda" ninguna sesión de cliente (ni una petición que ya iba en vuelo)
// puede volver a recordar la tienda anterior: solo una elección explícita la reactiva.
// La marca vive en el dispositivo y no en memoria: al recargar la página sigue vigente.
const RELEASED_KEY = 'vaiinilla.buyer.place-released.v1';

function isReleased(): boolean {
  try {
    return localStorage.getItem(RELEASED_KEY) === '1' || sessionStorage.getItem(RELEASED_KEY) === '1';
  } catch {
    return false;
  }
}

function setReleased(value: boolean): void {
  try {
    if (value) {
      localStorage.setItem(RELEASED_KEY, '1');
      sessionStorage.setItem(RELEASED_KEY, '1');
    } else {
      localStorage.removeItem(RELEASED_KEY);
      sessionStorage.removeItem(RELEASED_KEY);
    }
  } catch {
    // sin almacenamiento no hay nada que recordar
  }
}

/** Elección explícita del cliente (código, QR, NFC, selector, abrir un menú). */
export function rememberPlace(slug: string): void {
  setReleased(false);
  localStorage.setItem(KEY, slug);
  sessionStorage.setItem(KEY, slug);
}

/** Lo usan las sesiones de cliente: no recuerda nada si el cliente acaba de soltar la tienda. */
export function rememberPlaceFromSession(slug: string): void {
  if (isReleased()) return;
  rememberPlace(slug);
}

export function forgetPlace(): void {
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
}

/** "Cambiar tienda": olvida la tienda y bloquea que las sesiones la vuelvan a recordar. */
export function releasePlace(): void {
  forgetPlace();
  setReleased(true);
}

export function lastPlaceSlug(): string | null {
  return localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
}
