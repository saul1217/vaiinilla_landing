import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/theme-context';
import { CartPage } from './cart-page';

const authState: { user: null | { email: string; displayName: string } } = { user: null };

const buyerSessionState: { context: null } = { context: null };

const {
  getEstablishment,
  getOperationalStatus,
  getMyWallet,
  getGuestCatalog,
  createOrder,
  listOrders,
  listReservations,
  createGuest,
  renewGuest,
  getLegalVersions,
  currentTable,
  tableSession,
  openClientSession,
  firebaseIdToken,
} = vi.hoisted(() => ({
  getEstablishment: vi.fn(),
  getOperationalStatus: vi.fn(),
  getMyWallet: vi.fn(),
  getGuestCatalog: vi.fn(),
  createOrder: vi.fn(),
  listOrders: vi.fn(),
  listReservations: vi.fn(),
  createGuest: vi.fn(),
  renewGuest: vi.fn(),
  getLegalVersions: vi.fn(),
  currentTable: vi.fn(),
  tableSession: vi.fn(),
  openClientSession: vi.fn(),
  firebaseIdToken: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    getEstablishment: (...args: unknown[]) => getEstablishment(...args) as Promise<unknown>,
    getOperationalStatus: (...args: unknown[]) => getOperationalStatus(...args) as Promise<unknown>,
    getMyWallet: (...args: unknown[]) => getMyWallet(...args) as Promise<unknown>,
    getGuestCatalog: (...args: unknown[]) => getGuestCatalog(...args) as Promise<unknown>,
    createOrder: (...args: unknown[]) => createOrder(...args) as Promise<unknown>,
    listOrders: (...args: unknown[]) => listOrders(...args) as Promise<unknown>,
    listReservations: (...args: unknown[]) => listReservations(...args) as Promise<unknown>,
    createGuest: (...args: unknown[]) => createGuest(...args) as Promise<unknown>,
    renewGuest: (...args: unknown[]) => renewGuest(...args) as Promise<unknown>,
    getLegalVersions: (...args: unknown[]) => getLegalVersions(...args) as Promise<unknown>,
    currentTable: (...args: unknown[]) => currentTable(...args) as Promise<unknown>,
    tableSession: (...args: unknown[]) => tableSession(...args) as Promise<unknown>,
    apiUrl: '/api/v1',
  },
}));

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: authState.user, ready: true, configured: true, signOut: vi.fn() }),
}));

vi.mock('../lib/firebase', () => ({
  firebaseIdToken: (...args: unknown[]) => firebaseIdToken(...args) as Promise<unknown>,
}));

vi.mock('../context/buyer-session', () => ({
  useBuyerSessionToken: () => null,
  useBuyerSession: () => ({
    context: buyerSessionState.context,
    opening: false,
    openClientSession: (...args: unknown[]) => openClientSession(...args) as Promise<unknown>,
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
      <ThemeProvider>
        <Routes>
          <Route path="/e/:slug/carrito" element={<CartPage />} />
          <Route path="/e/:slug/m/:token/quien" element={<p>Elegir participante</p>} />
          <Route path="/cuenta/pedidos" element={<p>Mis pedidos</p>} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

// Lo que el servidor devuelve de la mesa de Kikin (GET /mesas/actual).
const mesaDeKikin = {
  espacio: { id: 5, nombre: 'Mesa 5', tipo: 'mesa' },
  sesion_id: '81f42715-e218-4e69-a7f6-8d4017a6f3d4',
  mi_alias: 'Kikin',
  mi_participante: { id: '9c42b167-4785-4f6c-ac30-b11ad86c58a6', alias: 'Kikin' },
};

describe('CartPage con participante de mesa', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    authState.user = null;
    cartState.cart = {
      slug: 'demo-a',
      establishmentName: 'Cafetería Demo A',
      lines: [{ productId: 1, quantity: 1, optionIds: [], productName: 'Chocolate', unitPreview: '120.00', imageUrl: null }],
    };
    getEstablishment.mockResolvedValue({
      id: '1',
      nombre: 'Cafetería Demo A',
      slug: 'demo-a',
      identificador_cliente_etiqueta: 'Matrícula',
      identificador_cliente_obligatorio: false,
      acepta_tarjeta: false,
    });
    getGuestCatalog.mockResolvedValue({ categorias: [], productos: [] });
    getOperationalStatus.mockResolvedValue({
      recibiendo_pedidos: true,
      sesion_caja_abierta: true,
      caja_en_linea: true,
      cocina_en_linea: true,
    });
    getMyWallet.mockResolvedValue(null);
    listReservations.mockResolvedValue([]);
    listOrders.mockResolvedValue({ orders: [] });
    createOrder.mockReset();
    createGuest.mockReset();
    renewGuest.mockReset();
    getLegalVersions.mockReset();
    getLegalVersions.mockResolvedValue({ terminos_version: 't-1', terminos_url: '/terminos', privacidad_version: 'p-1', privacidad_url: '/privacidad' });
    createGuest.mockResolvedValue({
      access_token: 'guest-jwt',
      expires_in: 900,
      contexto: { establecimiento_id: '1' },
      invitado: { nombre: '', llave: 'L'.repeat(43) },
    });
    renewGuest.mockRejectedValue(new Error('sin llave'));
    currentTable.mockReset().mockResolvedValue(mesaDeKikin);
    tableSession.mockReset().mockResolvedValue({
      espacio: { id: 5, nombre: 'Mesa 5', tipo: 'mesa' },
      sesion_id: '81f42715-e218-4e69-a7f6-8d4017a6f3d4',
      participantes: [{ id: '9c42b167-4785-4f6c-ac30-b11ad86c58a6', alias: 'Kikin' }],
      yo: { id: '9c42b167-4785-4f6c-ac30-b11ad86c58a6', alias: 'Kikin' },
    });
  });

  it('con participante vigente no pide nombre y muestra "Pides como"', async () => {
    localStorage.setItem(
      'vaiinilla.buyer.space.v1',
      JSON.stringify({ slug: 'demo-a', espacioId: 5, nombre: 'Mesa 5', tipo: 'mesa', qrToken: 'qr-5', guardadoEn: Date.now() }),
    );
    localStorage.setItem(
      'vaiinilla.buyer.table-participant.v1',
      JSON.stringify({ slug: 'demo-a', espacioId: 5, sesionId: '81f42715-e218-4e69-a7f6-8d4017a6f3d4', participanteId: '9c42b167-4785-4f6c-ac30-b11ad86c58a6', alias: 'Kikin' }),
    );
    const user = userEvent.setup();
    renderCart();
    await waitFor(() => expect(currentTable).toHaveBeenCalledWith('guest-jwt'));
    await user.click(await screen.findByRole('button', { name: /^continuar$/i }));
    expect(await screen.findByText(/pides como kikin/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /cambiar/i })).toHaveAttribute(
      'href',
      '/e/demo-a/m/qr-5/quien?next=%2Fe%2Fdemo-a%2Fcarrito',
    );
    // No pide el nombre: el pedido ya va a su nombre.
    expect(screen.queryByLabelText('Tu nombre')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^continuar con/i })).toBeEnabled();
  });

  it('con participante vigente confirma con la llave anónima: el alias nunca llega a createGuest', async () => {
    localStorage.setItem(
      'vaiinilla.buyer.space.v1',
      JSON.stringify({ slug: 'demo-a', espacioId: 5, nombre: 'Mesa 5', tipo: 'mesa', qrToken: 'qr-5', guardadoEn: Date.now() }),
    );
    localStorage.setItem(
      'vaiinilla.buyer.table-participant.v1',
      JSON.stringify({ slug: 'demo-a', espacioId: 5, sesionId: '81f42715-e218-4e69-a7f6-8d4017a6f3d4', participanteId: '9c42b167-4785-4f6c-ac30-b11ad86c58a6', alias: 'Kikin' }),
    );
    // La misma llave anónima con que se unió a la mesa.
    localStorage.setItem(
      'vaiinilla.buyer.guest.v1',
      JSON.stringify({ nombre: '', llave: 'L'.repeat(43) }),
    );
    renewGuest.mockResolvedValue({
      access_token: 'guest-jwt',
      expires_in: 900,
      contexto: { establecimiento_id: '1' },
      invitado: { nombre: '', llave: 'L'.repeat(43) },
    });
    createOrder.mockResolvedValue({
      id: 'ord-mesa',
      folio: 31,
      estado: 'por_cobrar',
      metodo_pago: 'efectivo',
      destino: 'en_espacio',
      qr_token: 'qr-seg',
      espacio: { id: 5 },
      total: '120.00',
      items: [],
      invitado: true,
      seguimiento_token: 'S'.repeat(43),
    });
    const user = userEvent.setup();
    renderCart();
    await waitFor(() => expect(currentTable).toHaveBeenCalledWith('guest-jwt'));
    await user.click(await screen.findByRole('button', { name: /^continuar$/i }));
    expect(await screen.findByText(/pides como kikin/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^continuar con/i }));
    await waitFor(() => expect(createOrder).toHaveBeenCalled());
    // Reusa la llave del dispositivo en vez de dar de alta otro invitado…
    expect(renewGuest).toHaveBeenCalledWith('demo-a', 'L'.repeat(43));
    expect(createGuest).not.toHaveBeenCalled();
    expect(createOrder.mock.calls[0]?.[1]).not.toHaveProperty('comensal_grupo');
    // …y aunque se diera de alta, el alias jamás va como nombre de invitado.
    for (const call of createGuest.mock.calls) {
      expect(JSON.stringify(call[0] ?? {})).not.toContain('Kikin');
    }
  });

  it('regresión #30: no crea el pedido si el alias local de Kikin está obsoleto y el backend aún no lo reconoce', async () => {
    localStorage.setItem(
      'vaiinilla.buyer.space.v1',
      JSON.stringify({ slug: 'demo-a', espacioId: 5, nombre: 'Mesa 5', tipo: 'mesa', qrToken: 'qr-5', guardadoEn: Date.now() }),
    );
    localStorage.setItem(
      'vaiinilla.buyer.table-participant.v1',
      JSON.stringify({ slug: 'demo-a', espacioId: 5, sesionId: '81f42715-e218-4e69-a7f6-8d4017a6f3d4', participanteId: 'stale-id', alias: 'Kikin' }),
    );
    tableSession.mockResolvedValue({
      espacio: { id: 5, nombre: 'Mesa 5', tipo: 'mesa' },
      sesion_id: '81f42715-e218-4e69-a7f6-8d4017a6f3d4',
      participantes: [{ id: '9c42b167-4785-4f6c-ac30-b11ad86c58a6', alias: 'Kikin', soy_yo: false }],
      yo: null,
    });
    const user = userEvent.setup();
    renderCart();

    await waitFor(() => expect(currentTable).toHaveBeenCalled());
    await user.click(await screen.findByRole('button', { name: /^continuar$/i }));
    await user.click(await screen.findByRole('button', { name: /continuar con pago en caja/i }));

    expect(await screen.findByText('Elegir participante')).toBeInTheDocument();
    expect(tableSession).toHaveBeenCalled();
    expect(createOrder).not.toHaveBeenCalled();
    expect(localStorage.getItem('vaiinilla.buyer.table-participant.v1')).toContain('Kikin');
  });

  it('si la sesión cambió se borra la identidad y se vuelve a pedir nombre', async () => {
    localStorage.setItem(
      'vaiinilla.buyer.space.v1',
      JSON.stringify({ slug: 'demo-a', espacioId: 5, nombre: 'Mesa 5', tipo: 'mesa', qrToken: 'qr-5', guardadoEn: Date.now() }),
    );
    localStorage.setItem(
      'vaiinilla.buyer.table-participant.v1',
      JSON.stringify({ slug: 'demo-a', espacioId: 5, sesionId: 'ses-vieja', participanteId: 'p-x', alias: 'X' }),
    );
    const user = userEvent.setup();
    renderCart();
    await waitFor(() => expect(currentTable).toHaveBeenCalled());
    await waitFor(() => expect(localStorage.getItem('vaiinilla.buyer.table-participant.v1')).toBeNull());
    await user.click(await screen.findByRole('button', { name: /^continuar$/i }));
    expect(await screen.findByRole('link', { name: 'Elegir participante' })).toHaveAttribute(
      'href',
      '/e/demo-a/m/qr-5/quien?next=%2Fe%2Fdemo-a%2Fcarrito',
    );
  });

  it('la mesa se libera entre cargar el carrito y pedir: no se crea el pedido y se olvida la mesa', async () => {
    localStorage.setItem(
      'vaiinilla.buyer.space.v1',
      JSON.stringify({ slug: 'demo-a', espacioId: 5, nombre: 'Mesa 5', tipo: 'mesa', qrToken: 'qr-5', guardadoEn: Date.now() }),
    );
    localStorage.setItem(
      'vaiinilla.buyer.table-participant.v1',
      JSON.stringify({ slug: 'demo-a', espacioId: 5, sesionId: '81f42715-e218-4e69-a7f6-8d4017a6f3d4', participanteId: '9c42b167-4785-4f6c-ac30-b11ad86c58a6', alias: 'Kikin' }),
    );
    let liberada = false;
    currentTable.mockImplementation(() => Promise.resolve(liberada ? null : mesaDeKikin));
    const user = userEvent.setup();
    renderCart();
    await user.click(await screen.findByRole('button', { name: /^continuar$/i }));
    expect(await screen.findByText(/pides como kikin/i)).toBeInTheDocument();
    liberada = true;
    await user.click(await screen.findByRole('button', { name: /continuar con pago en caja/i }));
    expect((await screen.findAllByText(/tu mesa ya no está abierta/i)).length).toBeGreaterThan(0);
    expect(createOrder).not.toHaveBeenCalled();
    expect(localStorage.getItem('vaiinilla.buyer.table-participant.v1')).toBeNull();
    expect(localStorage.getItem('vaiinilla.buyer.space.v1')).toBeNull();
  });

  it('mesa liberada antes de entrar: el teléfono olvida la mesa y su identidad, sin reabrirla', async () => {
    localStorage.setItem(
      'vaiinilla.buyer.space.v1',
      JSON.stringify({ slug: 'demo-a', espacioId: 5, nombre: 'Mesa 5', tipo: 'mesa', qrToken: 'qr-5', guardadoEn: Date.now() }),
    );
    localStorage.setItem(
      'vaiinilla.buyer.table-participant.v1',
      JSON.stringify({ slug: 'demo-a', espacioId: 5, sesionId: 'ses-vieja', participanteId: 'p-x', alias: 'X' }),
    );
    currentTable.mockResolvedValue(null);
    const user = userEvent.setup();
    renderCart();
    await waitFor(() => expect(localStorage.getItem('vaiinilla.buyer.table-participant.v1')).toBeNull());
    expect(localStorage.getItem('vaiinilla.buyer.space.v1')).toBeNull();
    await user.click(await screen.findByRole('button', { name: /^continuar$/i }));
    expect(screen.queryByRole('link', { name: 'Elegir participante' })).not.toBeInTheDocument();
  });

  it('sin mesa (para llevar) sigue pidiendo el nombre como antes', async () => {
    const user = userEvent.setup();
    renderCart();
    await user.click(await screen.findByRole('button', { name: /^continuar$/i }));
    expect(await screen.findByLabelText('Tu nombre')).toBeInTheDocument();
    expect(screen.queryByText(/pides como/i)).not.toBeInTheDocument();
    expect(currentTable).not.toHaveBeenCalled();
    expect(tableSession).not.toHaveBeenCalled();
    // Sin nombre no continúa (regresión del flujo de invitado).
    expect(screen.getByRole('button', { name: /^continuar con/i })).toBeDisabled();
  });
});
