import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { beginCheckoutSubmit, canSilentlyApplyServiceWorkerUpdate } from './pwa-update';
import * as cartStorage from './cart-storage';
import * as stripePending from './stripe-pending';
import * as stripeSession from './stripe-session';

describe('canSilentlyApplyServiceWorkerUpdate', () => {
  beforeEach(() => {
    vi.spyOn(cartStorage, 'readCart').mockReturnValue(null);
    vi.spyOn(stripePending, 'readPendingStripeOrderId').mockReturnValue(null);
    vi.spyOn(stripePending, 'stripeConfirmingInProgress').mockReturnValue(false);
    vi.spyOn(stripeSession, 'stripeCheckoutInProgress').mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('permite actualizar con carrito vacío y sin checkout', () => {
    expect(canSilentlyApplyServiceWorkerUpdate()).toBe(true);
  });

  it('bloquea si hay líneas en el carrito', () => {
    vi.mocked(cartStorage.readCart).mockReturnValue({
      slug: 'demo',
      establishmentName: 'Demo',
      lines: [{ productId: 1, quantity: 1, optionIds: [], productName: 'X', unitPreview: '1', imageUrl: null }],
    });
    expect(canSilentlyApplyServiceWorkerUpdate()).toBe(false);
  });

  it('bloquea mientras se envía un pedido', () => {
    const end = beginCheckoutSubmit();
    expect(canSilentlyApplyServiceWorkerUpdate()).toBe(false);
    end();
    expect(canSilentlyApplyServiceWorkerUpdate()).toBe(true);
  });

  it('bloquea con pago Stripe pendiente o 3DS', () => {
    vi.mocked(stripePending.readPendingStripeOrderId).mockReturnValue('ord-1');
    expect(canSilentlyApplyServiceWorkerUpdate()).toBe(false);

    vi.mocked(stripePending.readPendingStripeOrderId).mockReturnValue(null);
    vi.mocked(stripePending.stripeConfirmingInProgress).mockReturnValue(true);
    expect(canSilentlyApplyServiceWorkerUpdate()).toBe(false);
  });
});
