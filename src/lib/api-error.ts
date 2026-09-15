import type { ApiErrorBody } from '../types/api';

const friendlyMessages: Record<string, string> = {
  UNAUTHENTICATED: 'Tu sesión terminó. Inicia sesión nuevamente.',
  EMAIL_NOT_VERIFIED: 'Verifica tu correo antes de continuar.',
  IDENTITY_NOT_REGISTERED:
    'La cuenta existe, pero todavía no completó su registro de identidad.',
  IDENTITY_EMAIL_CONFLICT:
    'Este correo ya está asociado con otra identidad. Solicita ayuda a soporte.',
  LEGAL_CONSENT_REQUIRED:
    'Debes aceptar las versiones vigentes de Términos y Privacidad para continuar.',
  ESTABLISHMENT_SUSPENDED: 'El establecimiento está suspendido para operaciones nuevas.',
  CONTEXT_NOT_ALLOWED: 'Esta cuenta no puede pedir en este establecimiento.',
  RATE_LIMITED: 'Se alcanzó el límite temporal. Espera antes de volver a intentar.',
  VALIDATION_ERROR: 'Revisa los datos capturados e inténtalo nuevamente.',
  INSUFFICIENT_BALANCE: 'No tienes saldo suficiente para este pedido.',
  PRODUCT_NOT_FOUND: 'Un producto del carrito ya no está disponible.',
  ORDER_INVALID_STATE: 'El pedido ya cambió de estado.',
};

export class VaiinillaApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly retryAfter?: number;

  constructor(status: number, body: ApiErrorBody, retryAfter?: number) {
    super(friendlyMessages[body.code] ?? body.message ?? 'No fue posible completar la operación.');
    this.name = 'VaiinillaApiError';
    this.status = status;
    this.code = body.code;
    this.details = body.details;
    this.retryAfter = retryAfter;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado. Intenta nuevamente.';
}

const firebaseAuthMessages: Record<string, string> = {
  'auth/invalid-credential': 'El correo o la contraseña no son correctos.',
  'auth/wrong-password': 'El correo o la contraseña no son correctos.',
  'auth/user-not-found': 'El correo o la contraseña no son correctos.',
  'auth/invalid-email': 'El correo no tiene un formato válido.',
  'auth/too-many-requests': 'Hay demasiados intentos. Espera un momento antes de continuar.',
  'auth/invalid-verification-code': 'El código no es válido o ya cambió. Prueba el código actual.',
  'auth/network-request-failed': 'No fue posible contactar Firebase. Revisa tu conexión.',
  'auth/operation-not-allowed': 'Google no está habilitado en este entorno. Usa correo y contraseña.',
  'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de terminar.',
  'auth/popup-blocked': 'El navegador bloqueó la ventana de Google. Permite ventanas emergentes.',
  'auth/account-exists-with-different-credential':
    'Ese correo ya existe con otro método de acceso. Entra con correo y contraseña.',
};

export function firebaseAuthMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String(error.code);
    if (firebaseAuthMessages[code]) return firebaseAuthMessages[code];
  }
  return errorMessage(error);
}
