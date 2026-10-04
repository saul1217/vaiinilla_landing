// Aviso de verificación de correo: se marca cuando el envío se disparó de verdad
// (202 del backend), para que /cuenta lo confirme en vez de prometerlo a ciegas.
// Vive en la sesión: al cerrarla se olvida, como el resto del flujo de compra.
const KEY = 'vaiinilla.buyer.verification-sent.v1';

export function markVerificationSent(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // Sin almacenamiento no hay aviso persistente; el reenvío sigue disponible.
  }
}

export function verificationWasSent(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function clearVerificationSent(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nada que borrar
  }
}
