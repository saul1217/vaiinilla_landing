import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  beginCheckoutSubmit,
  beginRegistrationFormDraft,
  beginReservationFormDraft,
  beginStripePaymentPanel,
  canSilentlyApplyServiceWorkerUpdate,
  resetPwaUpdateGuardsForTests,
} from './pwa-update';
import * as cartStorage from './cart-storage';
import * as stripePending from './stripe-pending';
import * as stripeSession from './stripe-session';

describe('canSilentlyApplyServiceWorkerUpdate', () => {
  beforeEach(() => {
    vi.spyOn(cartStorage, 'readCart').mockReturnValue(null);
    vi.spyOn(stripePending, 'readPendingStripeOrderId').mockReturnValue(null);
    vi.spyOn(stripePending, 'stripeConfirmingInProgress').mockReturnValue(false);
    vi.spyOn(stripeSession, 'stripeCheckoutInProgress').mockReturnValue(false);
    resetPwaUpdateGuardsForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetPwaUpdateGuardsForTests();
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

  it('P3b: bloquea mientras el panel Stripe está montado', () => {
    const end = beginStripePaymentPanel();
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

  it('bloquea con borrador en registro o reservas', () => {
    const endReg = beginRegistrationFormDraft('test-auth');
    expect(canSilentlyApplyServiceWorkerUpdate()).toBe(false);
    endReg();

    const endRes = beginReservationFormDraft('test-res');
    expect(canSilentlyApplyServiceWorkerUpdate()).toBe(false);
    endRes();
    expect(canSilentlyApplyServiceWorkerUpdate()).toBe(true);
  });
});
