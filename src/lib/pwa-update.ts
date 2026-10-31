import { readCart } from './cart-storage';
import { readPendingStripeOrderId, stripeConfirmingInProgress } from './stripe-pending';
import { stripeCheckoutInProgress } from './stripe-session';

/** Tras este tiempo sin interacción, un SW en espera puede aplicarse con carrito vacío. */
export const PWA_UPDATE_IDLE_MS = 2 * 60_000;

/** Revisa el registro del SW periódicamente por si hay build nuevo. */
export const PWA_REGISTRATION_UPDATE_MS = 30 * 60_000;

let checkoutSubmits = 0;
let stripePaymentPanels = 0;
const registrationFormDrafts = new Set<string>();
const reservationFormDrafts = new Set<string>();

/** Marca un envío de pedido o confirmación Stripe en curso (no interrumpir con SKIP_WAITING). */
export function beginCheckoutSubmit(): () => void {
  checkoutSubmits += 1;
  return () => {
    checkoutSubmits = Math.max(0, checkoutSubmits - 1);
  };
}

/** Formulario de tarjeta Stripe visible (incluye teclear en el iframe). */
export function beginStripePaymentPanel(): () => void {
  stripePaymentPanels += 1;
  return () => {
    stripePaymentPanels = Math.max(0, stripePaymentPanels - 1);
  };
}

export function beginRegistrationFormDraft(id: string): () => void {
  registrationFormDrafts.add(id);
  return () => {
    registrationFormDrafts.delete(id);
  };
}

export function beginReservationFormDraft(id: string): () => void {
  reservationFormDrafts.add(id);
  return () => {
    reservationFormDrafts.delete(id);
  };
}

export function canSilentlyApplyServiceWorkerUpdate(): boolean {
  const cart = readCart();
  if (cart && cart.lines.length > 0) return false;
  if (checkoutSubmits > 0) return false;
  if (stripePaymentPanels > 0) return false;
  if (readPendingStripeOrderId()) return false;
  if (stripeConfirmingInProgress()) return false;
  if (stripeCheckoutInProgress()) return false;
  if (registrationFormDrafts.size > 0) return false;
  if (reservationFormDrafts.size > 0) return false;
  return true;
}

/** Solo pruebas: evita fugas de contadores entre archivos. */
export function resetPwaUpdateGuardsForTests(): void {
  checkoutSubmits = 0;
  stripePaymentPanels = 0;
  registrationFormDrafts.clear();
  reservationFormDrafts.clear();
}
