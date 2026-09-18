import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { STRIPE_COPY } from '../lib/stripe-status';
import { PedidoChargeOverlay } from './pedido-charge-overlay';

describe('PedidoChargeOverlay', () => {
  it('muestra carga mientras la compra está en proceso', () => {
    render(<PedidoChargeOverlay phase="processing" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText(STRIPE_COPY.processing)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ver pedido/i })).not.toBeInTheDocument();
  });

  it('muestra palomita cuando ya se cobró', async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(<PedidoChargeOverlay phase="success" onDismiss={onDismiss} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByText(STRIPE_COPY.confirmed)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /ver pedido/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
