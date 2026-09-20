import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StoreBadges } from './store-badges';

vi.mock('../lib/store-links', () => ({
  storeHref: () => null,
}));

describe('StoreBadges', () => {
  it('muestra App Store y Google Play como Próximamente sin enlaces rotos', () => {
    render(<StoreBadges />);
    const apple = screen.getByText('App Store').closest('[data-store="apple"]');
    const play = screen.getByText('Google Play').closest('[data-store="play"]');
    expect(apple?.tagName).toBe('SPAN');
    expect(play?.tagName).toBe('SPAN');
    expect(apple).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getAllByText('Próximamente').length).toBe(2);
    expect(screen.queryByRole('link', { name: /app store/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /google play/i })).not.toBeInTheDocument();
  });
});
