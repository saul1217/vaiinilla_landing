import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SupportPage } from './support-page';

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: null, ready: true, configured: false, signOut: vi.fn() }),
}));

vi.mock('../context/cart-context', () => ({
  useCart: () => ({ cart: null }),
}));

describe('SupportPage', () => {
  it('conserva contacto y legales del establecimiento', () => {
    render(
      <MemoryRouter>
        <SupportPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /equipo@vaiinilla.app/i })).toHaveAttribute(
      'href',
      'mailto:equipo@vaiinilla.app',
    );
    expect(screen.getByRole('link', { name: /términos/i })).toHaveAttribute(
      'href',
      'https://app.vaiinilla.app/legal/terminos/2026-07',
    );
  });
});
