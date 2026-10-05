/**
 * ¿El navegador guarda datos? En modo privado estricto `localStorage` falla y el
 * pedido solo vive en su enlace: hay que decirlo fuerte, no suponerlo.
 */
export function isStorageAvailable(): boolean {
  try {
    const probe = '__vaiinilla_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}
