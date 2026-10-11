const KEY = 'vaiinilla.buyer.last-place.v1';

// Tras "Cambiar tienda" ninguna sesión de cliente (ni una petición que ya iba en vuelo)
// puede volver a recordar la tienda anterior: solo una elección explícita la reactiva.
let released = false;

/** Elección explícita del cliente (código, QR, NFC, selector, abrir un menú). */
export function rememberPlace(slug: string): void {
  released = false;
  localStorage.setItem(KEY, slug);
  sessionStorage.setItem(KEY, slug);
}

/** Lo usan las sesiones de cliente: no recuerda nada si el cliente acaba de soltar la tienda. */
export function rememberPlaceFromSession(slug: string): void {
  if (released) return;
  rememberPlace(slug);
}

export function forgetPlace(): void {
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
}

/** "Cambiar tienda": olvida la tienda y bloquea que las sesiones la vuelvan a recordar. */
export function releasePlace(): void {
  forgetPlace();
  released = true;
}

export function lastPlaceSlug(): string | null {
  return localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
}
