import { readCart } from './cart-storage';
import { readPendingStripeOrderId, stripeConfirmingInProgress } from './stripe-pending';
import { stripeCheckoutInProgress } from './stripe-session';

/** Tras este tiempo sin interacción, un SW en espera puede aplicarse con carrito vacío. */
export const PWA_UPDATE_IDLE_MS = 2 * 60_000;

let checkoutSubmits = 0;

/** Marca un envío de pedido o confirmación Stripe en curso (no interrumpir con SKIP_WAITING). */
export function beginCheckoutSubmit(): () => void {
  checkoutSubmits += 1;
  return () => {
    checkoutSubmits = Math.max(0, checkoutSubmits - 1);
  };
}

export function canSilentlyApplyServiceWorkerUpdate(): boolean {
  const cart = readCart();
  if (cart && cart.lines.length > 0) return false;
  if (checkoutSubmits > 0) return false;
  if (readPendingStripeOrderId()) return false;
  if (stripeConfirmingInProgress()) return false;
  if (stripeCheckoutInProgress()) return false;
  return true;
}
