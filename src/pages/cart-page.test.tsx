import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CartPage } from './cart-page';

const getEstablishment = vi.fn();

vi.mock('../lib/api', () => ({
  api: {
    getEstablishment: (...args: unknown[]) => getEstablishment(...args) as Promise<unknown>,
    getOperationalStatus: vi.fn(),
    getMyWallet: vi.fn(),
    createOrder: vi.fn(),
    createStripePayment: vi.fn(),
  },
}));

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({
    user: { email: 'ana@example.test', displayName: 'Ana' },
    ready: true,
    configured: true,
    signOut: vi.fn(),
  }),
}));

vi.mock('../context/buyer-session', () => ({
  useBuyerSession: () => ({
    context: null,
    opening: false,
    openClientSession: vi.fn(),
    clearSession: vi.fn(),
  }),
}));

const cartState = {
  cart: null as null | {
    slug: string;
    establishmentName: string;
    lines: Array<{
      productId: number;
      quantity: number;
      optionIds: number[];
      productName: string;
      unitPreview: string;
      imageUrl: string | null;
    }>;
  },
  updateQuantity: vi.fn(),
  removeLine: vi.fn(),
  reset: vi.fn(),
};

vi.mock('../context/cart-context', () => ({
  useCart: () => cartState,
}));

function renderCart() {
  return render(
    <MemoryRouter initialEntries={['/e/demo-a/carrito']}>
      <Routes>
        <Route path="/e/:slug/carrito" element={<CartPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CartPage', () => {
  beforeEach(() => {
    getEstablishment.mockResolvedValue({
      id: '1',
      nombre: 'Cafetería Demo A',
      slug: 'demo-a',
      identificador_cliente_etiqueta: 'Matrícula',
      identificador_cliente_obligatorio: false,
    });
    cartState.cart = null;
  });

  it('muestra el vacío ilustrado', async () => {
    renderCart();
    expect(await screen.findByRole('heading', { name: /tu carrito está vacío/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /explorar menú/i })).toHaveAttribute('href', '/e/demo-a');
  });

  it('abre el sheet de pago con efectivo, saldo y tarjeta', async () => {
    cartState.cart = {
      slug: 'demo-a',
      establishmentName: 'Cafetería Demo A',
      lines: [
        {
          productId: 1,
          quantity: 1,
          optionIds: [],
          productName: 'Taco',
          unitPreview: '25.00',
          imageUrl: null,
        },
      ],
    };
    const user = userEvent.setup();
    renderCart();
    await user.click(await screen.findByRole('button', { name: /^pagar$/i }));
    expect(await screen.findByRole('heading', { name: /cómo quieres pagar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /efectivo al recoger/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /saldo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tarjeta/i })).toBeDisabled();
    expect(screen.getByText(/pago con tarjeta no disponible por ahora/i)).toBeInTheDocument();
  });
});
