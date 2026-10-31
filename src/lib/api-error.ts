import type { ApiErrorBody } from '../types/api';

const friendlyMessages: Record<string, string> = {
  UNAUTHENTICATED: 'Tu acceso terminó. Entra de nuevo.',
  EMAIL_NOT_VERIFIED: 'Verifica tu correo antes de continuar.',
  IDENTITY_NOT_REGISTERED:
    'La cuenta existe, pero todavía no completó su registro de identidad.',
  IDENTITY_EMAIL_CONFLICT:
    'Este correo ya está asociado con otra identidad. Solicita ayuda a soporte.',
  LEGAL_CONSENT_REQUIRED:
    'Debes aceptar las versiones vigentes de Términos y Privacidad para continuar.',
  ESTABLISHMENT_SUSPENDED: 'El establecimiento está suspendido para operaciones nuevas.',
  SPACE_NOT_FOUND: 'No encontramos esa mesa. Revisa el código e inténtalo de nuevo.',
  SPACE_INACTIVE: 'Esa mesa está inactiva. Pide ayuda en Caja.',
  SPACE_TOKEN_INVALID: 'Ese código de mesa no es válido.',
  SPACE_TOKEN_REVOKED: 'Ese código de mesa ya no sirve. Pide el código actualizado.',
  BACKEND_UNAVAILABLE: 'El servicio no está disponible. Inténtalo de nuevo en un momento.',
  CONTEXT_NOT_ALLOWED: 'Esta cuenta no puede pedir en este establecimiento.',
  RATE_LIMITED: 'Se alcanzó el límite temporal. Espera antes de volver a intentar.',
  VALIDATION_ERROR: 'Revisa los datos capturados e inténtalo nuevamente.',
  REAUTHENTICATION_REQUIRED: 'Confirma tu acceso otra vez para eliminar la cuenta.',
  INSUFFICIENT_BALANCE: 'No tienes saldo suficiente para este pedido.',
  PRODUCT_NOT_FOUND: 'Un producto del carrito ya no está disponible.',
  ACCOUNT_REQUIRED: 'Para apartar una cancha, entra a tu cuenta o crea una.',
  ENTRY_TOKEN_INVALID: 'El código del lugar ya no está disponible. Vuelve a intentarlo o entra a tu cuenta.',
  GUEST_RESERVATION_LIMIT: 'Llegaste al límite de reservas sin cuenta. Entra o crea una para seguir apartando.',
  ORDER_INVALID_STATE: 'El pedido ya cambió de estado.',
};

export const RATE_LIMIT_MESSAGE = 'Hay demasiados intentos en poco tiempo. Espera un momento y vuelve a intentar.';

export class VaiinillaApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly retryAfter?: number;

  constructor(status: number, body: ApiErrorBody, retryAfter?: number) {
    // Todo 429 pide esperar, salvo el límite de reservas sin cuenta, que pide iniciar sesión.
    super(
      (status === 429 && body.code !== 'GUEST_RESERVATION_LIMIT' ? RATE_LIMIT_MESSAGE : undefined) ??
        friendlyMessages[body.code] ??
        body.message ??
        'No fue posible completar la operación.',
    );
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
  'auth/user-mismatch': 'Elige la misma cuenta de Google con la que entraste.',
  'auth/popup-blocked': 'El navegador bloqueó la ventana de Google. Permite ventanas emergentes.',
  'auth/email-already-in-use': 'Este correo ya tiene una cuenta. Entra o recupera tu contraseña.',
  'auth/weak-password': 'La contraseña es muy débil. Usa al menos 8 caracteres.',
  'auth/missing-password': 'Escribe tu contraseña.',
  'auth/missing-email': 'Escribe tu correo.',
  'auth/user-disabled': 'Esta cuenta está deshabilitada. Solicita ayuda a soporte.',
  'auth/requires-recent-login': 'Confirma tu acceso otra vez para continuar.',
  'auth/expired-action-code': 'El enlace ya venció. Pide uno nuevo.',
  'auth/invalid-action-code': 'El enlace no es válido o ya se usó. Pide uno nuevo.',
  'auth/code-expired': 'El código venció. Pide uno nuevo.',
  'auth/internal-error': 'Ocurrió un problema en el servicio de acceso. Inténtalo de nuevo en un momento.',
  'auth/account-exists-with-different-credential':
    'Ese correo ya existe con otro método de acceso. Entra con correo y contraseña.',
};

const FIREBASE_GENERIC_MESSAGE = 'No pudimos completar el acceso. Inténtalo de nuevo.';

// Configuración del proyecto (referer/dominio/API key), no un error del usuario: se distingue del genérico.
export const FIREBASE_BLOCKED_MESSAGE = 'Este sitio no está autorizado para acceder. Avisa a soporte.';
const FIREBASE_BLOCKED_CODE =
  /^auth\/(requests-from-referer|unauthorized-domain|invalid-api-key|api-key-not-valid|app-not-authorized)/;

export function firebaseAuthMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String(error.code);
    if (firebaseAuthMessages[code]) return firebaseAuthMessages[code];
    if (FIREBASE_BLOCKED_CODE.test(code)) return FIREBASE_BLOCKED_MESSAGE;
    if (code.startsWith('auth/')) return FIREBASE_GENERIC_MESSAGE;
  }
  // Nunca se muestra el texto técnico del SDK: «Firebase: Error (auth/...)».
  if (error instanceof Error && /^Firebase:|\(auth\/[\w-]+\)/.test(error.message)) {
    return FIREBASE_GENERIC_MESSAGE;
  }
  return errorMessage(error);
}
