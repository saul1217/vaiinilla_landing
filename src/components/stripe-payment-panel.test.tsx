import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { StripeOrderTotal, StripePaymentPanel } from '../components/stripe-payment-panel';
import { STRIPE_TOTAL_LABEL } from '../lib/stripe-status';
import type { OrderDetail, StripePaymentSession } from '../types/api';

vi.mock('../lib/api', () => ({
  api: { apiUrl: '/api/v1' },
}));

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn().mockResolvedValue({}),
}));

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PaymentElement: () => <div data-testid="stripe-payment-element" />,
  useStripe: () => ({ confirmPayment: vi.fn().mockResolvedValue({}) }),
  useElements: () => ({}),
}));

const order = {
  id: 'ord-1',
  folio: 7,
  estado: 'por_cobrar',
  metodo_pago: 'stripe',
  total: '123.60',
} as OrderDetail;

const session: StripePaymentSession = {
  payment_attempt_id: 'attempt-1',
  payment_intent_id: 'pi_test_001',
  client_secret: 'pi_test_001_secret_test',
  stripe_account_id: 'acct_test_001',
  publishable_key: 'pk_test_51Vaiinilla',
  payment_status: 'pendiente_pago',
};

describe('StripePaymentPanel', () => {
  it('muestra el total del backend para un producto de 120', () => {
    render(<StripeOrderTotal order={order} />);
    expect(screen.getByText(STRIPE_TOTAL_LABEL)).toBeInTheDocument();
    expect(screen.getByText('$123.60 MXN')).toBeInTheDocument();
    expect(screen.queryByText('$120.00 MXN')).not.toBeInTheDocument();
  });

  it('abre Payment Element con la cuenta conectada y sin copy de caja', () => {
    render(
      <StripePaymentPanel order={order} session={session} hostname="localhost" onConfirmed={() => undefined} onCanceled={() => undefined} />,
    );
    expect(screen.getByTestId('stripe-payment-element')).toBeInTheDocument();
    expect(screen.queryByText(/pasa a caja/i)).not.toBeInTheDocument();
  });
});
