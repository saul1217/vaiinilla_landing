import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/theme-context';
import { currentScannedTable } from '../lib/scanned-table';
import { VaiinillaApiError } from '../lib/api-error';
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

  it('si /mesas/actual devuelve null conserva silla e identidad y va a Quién eres', async () => {
    const storedSpace = { slug: 'demo-a', espacioId: 5, nombre: 'Mesa 5', tipo: 'mesa', qrToken: 'qr-5', guardadoEn: Date.now() };
    const storedParticipant = { slug: 'demo-a', espacioId: 5, sesionId: '81f42715-e218-4e69-a7f6-8d4017a6f3d4', participanteId: '9c42b167-4785-4f6c-ac30-b11ad86c58a6', alias: 'Kikin' };
    localStorage.setItem('vaiinilla.buyer.space.v1', JSON.stringify(storedSpace));
    localStorage.setItem('vaiinilla.buyer.table-participant.v1', JSON.stringify(storedParticipant));
    currentTable.mockResolvedValueOnce(null);
    renderCart();
    await waitFor(() => expect(currentTable).toHaveBeenCalledWith('guest-jwt'));
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /^continuar$/i }));
    expect(screen.getByRole('link', { name: 'Cambiar' })).toHaveAttribute(
      'href',
      '/e/demo-a/m/qr-5/quien?next=%2Fe%2Fdemo-a%2Fcarrito',
    );
    expect(localStorage.getItem('vaiinilla.buyer.space.v1')).not.toBeNull();
    expect(localStorage.getItem('vaiinilla.buyer.table-participant.v1')).not.toBeNull();
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
    expect(renewGuest).toHaveBeenCalledWith('demo-a', 'L'.repeat(43), {});
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

  it('null al confirmar conserva la identidad y lleva a Quién eres sin crear pedido', async () => {
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
    expect(await screen.findByText('Elegir participante')).toBeInTheDocument();
    expect(createOrder).not.toHaveBeenCalled();
    expect(localStorage.getItem('vaiinilla.buyer.table-participant.v1')).not.toBeNull();
    expect(localStorage.getItem('vaiinilla.buyer.space.v1')).not.toBeNull();
  });

  it('un null transitorio antes de reingresar conserva la mesa y crea el pedido ahí', async () => {
    localStorage.setItem('vaiinilla.buyer.space.v1', JSON.stringify({ slug: 'demo-a', espacioId: 5, nombre: 'Mesa 5', tipo: 'mesa', qrToken: 'qr-5', guardadoEn: Date.now() }));
    localStorage.setItem('vaiinilla.buyer.table-participant.v1', JSON.stringify({ slug: 'demo-a', espacioId: 5, sesionId: mesaDeKikin.sesion_id, participanteId: mesaDeKikin.mi_participante.id, alias: 'Kikin' }));
    localStorage.setItem('vaiinilla.buyer.guest.v1', JSON.stringify({ nombre: '', llave: 'L'.repeat(43) }));
    renewGuest.mockResolvedValue({ access_token: 'guest-jwt', expires_in: 900, contexto: { establecimiento_id: '1' }, invitado: { nombre: '', llave: 'L'.repeat(43) } });
    currentTable.mockResolvedValueOnce(null).mockResolvedValue(mesaDeKikin);
    tableSession.mockResolvedValue({ espacio: mesaDeKikin.espacio, sesion_id: mesaDeKikin.sesion_id, participantes: [mesaDeKikin.mi_participante], yo: mesaDeKikin.mi_participante });
    createOrder.mockResolvedValue({ id: 'ord-mesa-null', folio: 41, estado: 'por_cobrar', metodo_pago: 'efectivo', destino: 'en_espacio', qr_token: 'qr-next', espacio: { id: 5 }, total: '120.00', items: [], invitado: true, seguimiento_token: 'S'.repeat(43) });
    const user = userEvent.setup();
    renderCart();
    await user.click(await screen.findByRole('button', { name: /^continuar$/i }));
    expect(await screen.findByText(/pides como kikin/i)).toBeInTheDocument();
    expect(localStorage.getItem('vaiinilla.buyer.space.v1')).not.toBeNull();
    expect(localStorage.getItem('vaiinilla.buyer.table-participant.v1')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: /continuar con pago en caja/i }));
    await waitFor(() => expect(createOrder).toHaveBeenCalled());
    expect(createOrder.mock.calls[0]?.[1]).toMatchObject({ destino: 'en_espacio', espacio_id: 5 });
  });

  it('cuando la mesa vuelve a aparecer (re-escaneo en otra pestaña), el destino vuelve a en espacio', async () => {
    // Arranca sin mesa en el dispositivo: el carrito nace 'para llevar'.
    localStorage.setItem('vaiinilla.buyer.guest.v1', JSON.stringify({ nombre: '', llave: 'L'.repeat(43) }));
    renewGuest.mockResolvedValue({ access_token: 'guest-jwt', expires_in: 900, contexto: { establecimiento_id: '1' }, invitado: { nombre: '', llave: 'L'.repeat(43) } });
    currentTable.mockResolvedValue(mesaDeKikin);
    tableSession.mockResolvedValue({ espacio: mesaDeKikin.espacio, sesion_id: mesaDeKikin.sesion_id, participantes: [mesaDeKikin.mi_participante], yo: mesaDeKikin.mi_participante });
    createOrder.mockResolvedValue({ id: 'ord-resync', folio: 42, estado: 'por_cobrar', metodo_pago: 'efectivo', destino: 'en_espacio', qr_token: 'qr-next', espacio: { id: 5 }, total: '120.00', items: [], invitado: true, seguimiento_token: 'S'.repeat(43) });
    const user = userEvent.setup();
    renderCart();
    await screen.findByRole('button', { name: /^continuar$/i });
    // La mesa reaparece (re-escaneo + 'Continuar como' en otra pestaña) y el carrito recupera el foco.
    localStorage.setItem('vaiinilla.buyer.space.v1', JSON.stringify({ slug: 'demo-a', espacioId: 5, nombre: 'Mesa 5', tipo: 'mesa', qrToken: 'qr-5', guardadoEn: Date.now() }));
    localStorage.setItem('vaiinilla.buyer.table-participant.v1', JSON.stringify({ slug: 'demo-a', espacioId: 5, sesionId: mesaDeKikin.sesion_id, participanteId: mesaDeKikin.mi_participante.id, alias: 'Kikin' }));
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await user.click(await screen.findByRole('button', { name: /^continuar$/i }));
    expect(await screen.findByText(/pides como kikin/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continuar con pago en caja/i }));
    await waitFor(() => expect(createOrder).toHaveBeenCalled());
    expect(createOrder.mock.calls[0]?.[1]).toMatchObject({ destino: 'en_espacio', espacio_id: 5 });
    expect(createOrder.mock.calls[0]?.[1]).not.toHaveProperty('confirmar_para_llevar');
  });

  it('pide confirmación al cambiar una mesa a para llevar; cancelar no crea pedido y confirmar manda el flag', async () => {
    localStorage.setItem('vaiinilla.buyer.space.v1', JSON.stringify({ slug: 'demo-a', espacioId: 5, nombre: 'Mesa 5', tipo: 'mesa', qrToken: 'qr-5', guardadoEn: Date.now() }));
    localStorage.setItem('vaiinilla.buyer.table-participant.v1', JSON.stringify({ slug: 'demo-a', espacioId: 5, sesionId: mesaDeKikin.sesion_id, participanteId: mesaDeKikin.mi_participante.id, alias: 'Kikin' }));
    localStorage.setItem('vaiinilla.buyer.guest.v1', JSON.stringify({ nombre: '', llave: 'L'.repeat(43) }));
    renewGuest.mockResolvedValue({ access_token: 'guest-jwt', expires_in: 900, contexto: { establecimiento_id: '1' }, invitado: { nombre: '', llave: 'L'.repeat(43) } });
    createOrder.mockResolvedValue({ id: 'ord-takeout', folio: 43, estado: 'por_cobrar', metodo_pago: 'efectivo', destino: 'para_llevar', qr_token: 'qr-next', espacio: null, total: '120.00', items: [], invitado: true, seguimiento_token: 'S'.repeat(43) });
    const user = userEvent.setup();
    renderCart();
    await user.click(await screen.findByRole('button', { name: /^continuar$/i }));
    expect(await screen.findByText(/pides como kikin/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /el pedido se entrega en tu mesa.*cambiar a para llevar/i }));
    await user.click(screen.getByRole('button', { name: /continuar con pago en caja/i }));
    expect(await screen.findByRole('dialog', { name: /¿pedir para llevar\?/i })).toBeInTheDocument();
    expect(createOrder).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(createOrder).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /continuar con pago en caja/i }));
    await user.click(await screen.findByRole('button', { name: /sí, pedir para llevar/i }));
    await waitFor(() => expect(createOrder).toHaveBeenCalled());
    expect(createOrder.mock.calls[0]?.[1]).toMatchObject({ destino: 'para_llevar', confirmar_para_llevar: true });
  });

  it('un 409 por silla activa vuelve a mostrar la confirmación para llevar', async () => {
    localStorage.setItem('vaiinilla.buyer.space.v1', JSON.stringify({ slug: 'demo-a', espacioId: 5, nombre: 'Mesa 5', tipo: 'mesa', qrToken: 'qr-5', guardadoEn: Date.now() }));
    localStorage.setItem('vaiinilla.buyer.table-participant.v1', JSON.stringify({ slug: 'demo-a', espacioId: 5, sesionId: mesaDeKikin.sesion_id, participanteId: mesaDeKikin.mi_participante.id, alias: 'Kikin' }));
    localStorage.setItem('vaiinilla.buyer.guest.v1', JSON.stringify({ nombre: '', llave: 'L'.repeat(43) }));
    renewGuest.mockResolvedValue({ access_token: 'guest-jwt', expires_in: 900, contexto: { establecimiento_id: '1' }, invitado: { nombre: '', llave: 'L'.repeat(43) } });
    createOrder.mockRejectedValue(new VaiinillaApiError(409, { code: 'PEDIDO_PARA_LLEVAR_CON_SILLA_ACTIVA', message: 'silla activa' }));
    const user = userEvent.setup();
    renderCart();
    await user.click(await screen.findByRole('button', { name: /^continuar$/i }));
    expect(await screen.findByText(/pides como kikin/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /el pedido se entrega en tu mesa.*cambiar a para llevar/i }));
    await user.click(screen.getByRole('button', { name: /continuar con pago en caja/i }));
    await user.click(await screen.findByRole('button', { name: /sí, pedir para llevar/i }));
    expect(await screen.findByRole('dialog', { name: /¿pedir para llevar\?/i })).toBeInTheDocument();
  });

  it('sin identidad local, null sí permite olvidar la mesa', async () => {
    localStorage.setItem(
      'vaiinilla.buyer.space.v1',
      JSON.stringify({ slug: 'demo-a', espacioId: 5, nombre: 'Mesa 5', tipo: 'mesa', qrToken: 'qr-5', guardadoEn: Date.now() }),
    );
    currentTable.mockResolvedValue(null);
    await currentScannedTable('guest-jwt', {
      slug: 'demo-a', espacioId: 5, nombre: 'Mesa 5', tipo: 'mesa', qrToken: 'qr-5',
    });
    expect(localStorage.getItem('vaiinilla.buyer.space.v1')).toBeNull();
    expect(localStorage.getItem('vaiinilla.buyer.table-participant.v1')).toBeNull();
  });

  it('cancha escaneada: no ofrece elegir participante (eso abriría la cancha sin renta)', async () => {
    localStorage.setItem(
      'vaiinilla.buyer.space.v1',
      JSON.stringify({ slug: 'demo-a', espacioId: 4, nombre: 'Cancha 01', tipo: 'cancha', qrToken: 'qr-4', guardadoEn: Date.now() }),
    );
    const user = userEvent.setup();
    renderCart();
    await user.click(await screen.findByRole('button', { name: /^continuar$/i }));
    expect(screen.queryByRole('link', { name: 'Elegir participante' })).not.toBeInTheDocument();
    expect(screen.queryByText(/primero elige quién eres/i)).not.toBeInTheDocument();
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
