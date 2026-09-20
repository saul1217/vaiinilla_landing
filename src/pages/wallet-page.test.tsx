import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/theme-context';
import { firebaseIdToken } from '../lib/firebase';
import { WalletBoardView, WalletPage } from './wallet-page';

const authState: { user: { email: string; displayName: string } | null } = {
  user: { email: 'ana@example.test', displayName: 'Ana Pérez' },
};

const buyerSessionState: {
  context: { access_token: string; contexto: { establecimiento_id: string } } | null;
} = {
  context: {
    access_token: 'jwt',
    contexto: { establecimiento_id: 'e1' },
  },
};

const cartState = {
  cart: { slug: 'demo-a', establishmentName: 'Demo A', lines: [] } as {
    slug: string;
    establishmentName: string;
    lines: unknown[];
  } | null,
};

const { getEstablishment, getGuestCatalog, getMyWallet, listAccesses, openClientSession } = vi.hoisted(
  () => ({
    getEstablishment: vi.fn(),
    getGuestCatalog: vi.fn(),
    getMyWallet: vi.fn(),
    listAccesses: vi.fn(),
    openClientSession: vi.fn(),
  }),
);

vi.mock('../lib/api', () => ({
  api: {
    getEstablishment: (...args: unknown[]) => getEstablishment(...args) as Promise<unknown>,
    getGuestCatalog: (...args: unknown[]) => getGuestCatalog(...args) as Promise<unknown>,
    getMyWallet: (...args: unknown[]) => getMyWallet(...args) as Promise<unknown>,
    listAccesses: (...args: unknown[]) => listAccesses(...args) as Promise<unknown>,
  },
}));

vi.mock('../lib/firebase', () => ({
  firebaseIdToken: vi.fn().mockResolvedValue('firebase-token'),
}));

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({
    user: authState.user,
    ready: true,
    configured: true,
    signOut: vi.fn(),
  }),
}));

vi.mock('../context/cart-context', () => ({
  useCart: () => ({ cart: cartState.cart }),
}));

vi.mock('../context/buyer-session', () => ({
  useBuyerSession: () => ({
    context: buyerSessionState.context,
    opening: false,
    openClientSession,
    clearSession: vi.fn(),
  }),
}));

function renderWallet() {
  return render(
    <MemoryRouter initialEntries={['/cuenta/saldo']}>
      <ThemeProvider>
        <Routes>
          <Route path="/cuenta/saldo" element={<WalletPage />} />
          <Route path="/cuenta" element={<p>Cuenta splash</p>} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('WalletPage', () => {
  beforeEach(() => {
    vi.mocked(firebaseIdToken).mockResolvedValue('firebase-token');
    sessionStorage.clear();
    localStorage.clear();
    authState.user = { email: 'ana@example.test', displayName: 'Ana Pérez' };
    buyerSessionState.context = {
      access_token: 'jwt',
      contexto: { establecimiento_id: 'e1' },
    };
    cartState.cart = { slug: 'demo-a', establishmentName: 'Demo A', lines: [] };
    getEstablishment.mockResolvedValue({
      id: 'e1',
      nombre: 'Demo A',
      slug: 'demo-a',
      identificador_cliente_etiqueta: 'Cliente',
      identificador_cliente_obligatorio: false,
    });
    getGuestCatalog.mockResolvedValue({
      categorias: [],
      productos: [
        {
          id: 2,
          categoria_id: 1,
          estacion_preparacion: 'caja',
          nombre: 'fruti Lupis',
          descripcion: null,
          ingredientes: null,
          alergenos: null,
          tiempo_estimado_min: 4,
          precio_mostrador: '22.00',
          precio_digital: '22.00',
          disponible: true,
          imagen_url: null,
          grupos_opcion: [],
        },
      ],
    });
    getMyWallet.mockResolvedValue({
      cliente: { usuario_id: 'u1', nombre: 'Ana Pérez', identificador_cliente: 'A01234' },
      wallet: { id: 'w1', usuario_id: 'u1', establecimiento_id: 'e1', saldo: '125.00', actualizado_en: null },
      movimientos: [
        {
          id: 'm1',
          tipo: 'pedido',
          descripcion: 'Pedido #42',
          monto: '70.00',
          saldo_posterior: '55.00',
          pedido_id: 'ord-1',
          creado_en: '2026-09-15T00:00:00Z',
        },
      ],
    });
    listAccesses.mockResolvedValue([
      {
        membresia_id: 'm1',
        establecimiento: { id: 'e1', nombre: 'Demo A', slug: 'demo-a' },
        rol: 'cliente',
        identificador_cliente: 'A1',
        estado_establecimiento: 'activo',
        cierre_operativo_disponible: false,
      },
    ]);
    openClientSession.mockResolvedValue({
      access_token: 'jwt',
      contexto: { establecimiento_id: 'e1' },
    });
    getMyWallet.mockClear();
    listAccesses.mockClear();
  });

  it('muestra saldo grande y atajos de Android', async () => {
    renderWallet();
    expect(await screen.findByText('$125.00')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /cartera/i })).toBeInTheDocument();
    const shortcuts = document.querySelector('.alumno-actions-3');
    expect(shortcuts).toBeTruthy();
    expect(within(shortcuts as HTMLElement).getByRole('link', { name: /^pagar$/i })).toHaveAttribute(
      'href',
      '/e/demo-a/carrito',
    );
    expect(within(shortcuts as HTMLElement).getByRole('link', { name: /^pedidos$/i })).toHaveAttribute(
      'href',
      '/cuenta/pedidos',
    );
    expect(within(shortcuts as HTMLElement).getByRole('link', { name: /^recargar$/i })).toHaveAttribute(
      'href',
      '/u/u1',
    );
    expect(screen.getByRole('link', { name: /abrir menú/i })).toHaveAttribute('href', '/e/demo-a');
    expect(screen.getByText('Saldo Vaiinilla')).toBeInTheDocument();
    expect(screen.getByText('Pedido #42')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /del menú/i })).toBeInTheDocument();
    expect(screen.getByText('fruti Lupis')).toBeInTheDocument();
  });

  it('sin last-place abre contexto por GET /sesiones/accesos', async () => {
    cartState.cart = null;
    buyerSessionState.context = null;
    renderWallet();
    expect(await screen.findByText('$125.00')).toBeInTheDocument();
    expect(listAccesses).toHaveBeenCalledWith('firebase-token');
    expect(openClientSession).toHaveBeenCalled();
    expect(getMyWallet).toHaveBeenCalledWith('jwt');
  });

  it('invitado no consulta saldo y va al splash', async () => {
    authState.user = null;
    renderWallet();
    expect(await screen.findByText(/cuenta splash/i)).toBeInTheDocument();
    expect(getMyWallet).not.toHaveBeenCalled();
    expect(listAccesses).not.toHaveBeenCalled();
  });

  it('error de saldo no fabrica un board de QA', async () => {
    getMyWallet.mockRejectedValue(new Error('No pudimos cargar el saldo.'));
    renderWallet();
    expect(await screen.findByText('No pudimos cargar el saldo.')).toBeInTheDocument();
    expect(screen.queryByText('$125.00')).not.toBeInTheDocument();
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
    expect(document.querySelector('.alumno-wallet-balance')).toBeNull();
  });

  it('vacío: clipboard, $0.00, atajos y sin movimientos inventados', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <WalletBoardView
            saldo="0.00"
            placeSlug="demo-a"
            reloadHref="/u/preview"
            movimientos={[]}
            menuPeek={[]}
          />
        </ThemeProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.getByText('Saldo Vaiinilla')).toBeInTheDocument();
    expect(document.querySelector('[data-wallet-orb="clipboard"]')).toBeTruthy();
    expect(document.querySelector('[data-wallet-pay="cart"]')).toBeTruthy();
    expect(document.querySelector('[data-wallet-orders="list"]')).toBeTruthy();
    expect(document.querySelector('[data-wallet-reload="qr"]')).toBeTruthy();
    expect(document.querySelector('[data-wallet-menu="book"]')).toBeTruthy();
    expect(document.querySelectorAll('[data-wallet-menu="book"] path')).toHaveLength(1);
    expect(document.querySelectorAll('[data-wallet-menu="book"] rect')).toHaveLength(0);
    expect(document.querySelector('[data-wallet-menu="book"] path')).not.toHaveAttribute('fill-rule');
    expect(document.querySelector('[data-wallet-menu="book"] path')?.getAttribute('d') ?? '').toContain('M21 5c-1.11');
    expect(document.querySelector('[data-wallet-menu="book"]')?.innerHTML).not.toContain('menu-book-gap');
    expect(document.querySelector('[data-wallet-menu-chev="arrow"]')).toBeTruthy();
    expect(screen.getByRole('link', { name: /^pagar$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^pedidos$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^recargar$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /abrir menú/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /movimientos/i })).not.toBeInTheDocument();
    expect(document.querySelectorAll('.alumno-moves li')).toHaveLength(0);
  });
});
