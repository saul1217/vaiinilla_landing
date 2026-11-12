import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CartProvider } from '../context/cart-context';
import { VaiinillaApiError } from '../lib/api-error';
import { writeCart } from '../lib/cart-storage';
import { parseStay, type HotelRequest, type Stay } from '../lib/hotel';
import type { HotelClient } from '../lib/hotel-client';
import type { HotelView } from '../lib/hotel-routes';
import { rememberSpace, type SpaceSession } from '../lib/space-session';
import type { OrderDetail } from '../types/api';
import { CartRoute, HotelScreen } from './hotel-page';

const ROOM: SpaceSession = { slug: 'hotel-sol', espacioId: 12, nombre: 'Habitación 101', tipo: 'mesa', qrToken: 'esp_puerta101', esHabitacion: true };

function stay(overrides: Record<string, unknown> = {}): Stay {
  return parseStay({
    id: 'st-1',
    estado: 'en_casa',
    huesped: 'Ana Pérez',
    espacio_id: 12,
    espacio_nombre: 'Habitación 101',
    piso: 1,
    entrada: '2026-11-09',
    salida: '2026-11-11',
    noches: 2,
    tarifa_noche: '1200.00',
    no_molestar: false,
    cuenta: { noches_total: '2400.00', cargos_total: '150.00', pedidos_total: '100.00', total: '2650.00', pedidos_pendientes: 1 },
    cargos: [{ id: 41, concepto: 'Minibar', categoria: 'minibar', monto: '150.00' }],
    pedidos: [{ id: 'p1', folio: 'A-014', estado: 'cobrado', total: '100.00', items_resumen: '2× Agua', por_cobrar: true }],
    ajustes: {
      cargo_habitacion_activo: true,
      tarjeta_al_pedir: true,
      solicitudes_activas: true,
      no_molestar_activo: true,
      hora_checkout: '12:00',
      salida_tardia_hora: '15:00',
      salida_tardia_precio: '250.00',
    },
    ...overrides,
  });
}

function request(overrides: Partial<HotelRequest> = {}): HotelRequest {
  return { id: 'r1', type: 'toallas', quantity: 2, note: null, status: 'pendiente', createdAt: null, ...overrides };
}

function makeClient(overrides: Partial<HotelClient> = {}): HotelClient {
  return {
    myStay: vi.fn(() => Promise.resolve(stay())),
    linkStay: vi.fn(() => Promise.resolve(stay())),
    config: vi.fn(() => Promise.reject(new Error('sin configuración'))),
    setDoNotDisturb: vi.fn(() => Promise.resolve(stay({ no_molestar: true }))),
    createRequest: vi.fn<HotelClient['createRequest']>((type, quantity) => Promise.resolve(request({ id: `new-${type}`, type, quantity }))),
    myRequests: vi.fn(() => Promise.resolve([] as HotelRequest[])),
    cancelRequest: vi.fn(() => Promise.resolve(request({ status: 'cancelada' }))),
    createOrder: vi.fn(() => Promise.resolve({ id: 'o1', folio: 14 } as OrderDetail)),
    ...overrides,
  };
}

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname}</output>;
}

function Screen({
  client,
  room,
  afterOrder,
  cardOffered,
  stripeTestMode,
}: {
  client: HotelClient;
  room: SpaceSession | null;
  afterOrder: () => void;
  cardOffered: boolean;
  stripeTestMode: boolean;
}) {
  const { view } = useParams();
  return (
    <HotelScreen
      client={client}
      slug="hotel-sol"
      view={view as HotelView | undefined}
      venueName="Hotel Sol"
      cardOffered={cardOffered}
      room={room}
      afterOrder={afterOrder}
      stripeTestMode={stripeTestMode}
    />
  );
}

function renderHotel(
  path: string,
  client = makeClient(),
  {
    room = ROOM,
    cardOffered = false,
    stripeTestMode = true,
  }: { room?: SpaceSession | null; cardOffered?: boolean; stripeTestMode?: boolean } = {},
) {
  const afterOrder = vi.fn();
  render(
    <CartProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/e/:slug/hotel" element={<Screen client={client} room={room} afterOrder={afterOrder} cardOffered={cardOffered} stripeTestMode={stripeTestMode} />} />
          <Route path="/e/:slug/hotel/:view" element={<Screen client={client} room={room} afterOrder={afterOrder} cardOffered={cardOffered} stripeTestMode={stripeTestMode} />} />
          <Route path="/e/:slug" element={<p>Menú del hotel</p>} />
        </Routes>
        <Where />
      </MemoryRouter>
    </CartProvider>,
  );
  return { client, afterOrder };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.stubEnv('VITE_FEATURE_HOTEL', 'true');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('código de estancia', () => {
  it('sin estancia pide el código y lo liga con el QR de la puerta', async () => {
    const user = userEvent.setup();
    const client = makeClient({ myStay: vi.fn(() => Promise.resolve(null)) });
    renderHotel('/e/hotel-sol/hotel', client);

    const input = await screen.findByLabelText('Código de estancia');
    const submit = screen.getByRole('button', { name: 'Entrar a mi habitación' });
    expect(submit).toBeDisabled();
    await user.type(input, '48a29-15');
    expect(input).toHaveValue('482915');
    await user.click(submit);

    await waitFor(() => expect(client.linkStay).toHaveBeenCalledWith('482915', { qrToken: 'esp_puerta101', roomId: 12 }));
    expect(await screen.findByRole('heading', { name: 'Habitación 101' })).toBeInTheDocument();
    expect(screen.getByText('Hola, Ana')).toBeInTheDocument();
    expect(client.myStay).toHaveBeenCalledWith(12);
  });

  it('un código que no coincide se explica sin salir de la pantalla', async () => {
    const user = userEvent.setup();
    const client = makeClient({
      myStay: vi.fn(() => Promise.resolve(null)),
      linkStay: vi.fn(() => Promise.reject(new VaiinillaApiError(404, { code: 'STAY_NOT_FOUND', message: 'x' }))),
    });
    renderHotel('/e/hotel-sol/hotel', client);
    await user.type(await screen.findByLabelText('Código de estancia'), '000000');
    await user.click(screen.getByRole('button', { name: 'Entrar a mi habitación' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ese código no coincide o ya venció');
    expect(screen.getByLabelText('Código de estancia')).toHaveAttribute('aria-invalid', 'true');
  });

  it('sin el QR de una habitación pide escanearlo', async () => {
    renderHotel('/e/hotel-sol/hotel', makeClient({ myStay: vi.fn(() => Promise.resolve(null)) }), { room: null });
    expect(await screen.findByRole('link', { name: 'Escanear el QR' })).toHaveAttribute('href', '/pedir');
    expect(screen.queryByLabelText('Código de estancia')).not.toBeInTheDocument();
  });
});

describe('bienvenida (H01)', () => {
  it('muestra la estancia y los servicios que el hotel encendió', async () => {
    renderHotel('/e/hotel-sol/hotel');
    expect(await screen.findByText('Estancia del 9 al 11 de nov · Piso 1')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Servicios del hotel' });
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Room serviceDesayuno, cena y bebidas',
      'LimpiezaToallas, amenidades',
      'Salida tardíaPide más tiempo',
      'Mi cuentaCargos y salida',
    ]);
    expect(screen.getByRole('link', { name: 'Pedir al cuarto' })).toHaveAttribute('href', '/e/hotel-sol');
  });

  it('sin solicitudes en el hotel no ofrece limpieza ni salida tardía', async () => {
    const client = makeClient({ myStay: vi.fn(() => Promise.resolve(stay({ ajustes: { solicitudes_activas: false } }))) });
    renderHotel('/e/hotel-sol/hotel', client);
    const nav = await screen.findByRole('navigation', { name: 'Servicios del hotel' });
    expect(within(nav).getAllByRole('link')).toHaveLength(2);
  });
});

describe('solicitudes (H05)', () => {
  it('envía cada cosa con su cantidad y el «sin molestar»', async () => {
    const user = userEvent.setup();
    const { client } = renderHotel('/e/hotel-sol/hotel/solicitudes');
    const towels = await screen.findByRole('button', { name: /Toallas/ });
    await user.click(towels);
    await user.click(towels);
    await user.click(screen.getByRole('button', { name: /Limpieza/ }));
    await user.click(screen.getByRole('button', { name: /Sin molestar/ }));
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud · 3' }));

    await waitFor(() => expect(client.setDoNotDisturb).toHaveBeenCalledWith(true));
    expect(client.createRequest).toHaveBeenCalledWith('toallas', 2, null, expect.any(String));
    expect(client.createRequest).toHaveBeenCalledWith('limpieza', 1, null, expect.any(String));
    expect(await screen.findByText('Listo, enviamos 3 solicitudes al hotel.')).toHaveAttribute('role', 'status');
    expect(screen.getByRole('button', { name: 'Elige lo que necesitas' })).toBeDisabled();
    expect(screen.getByText('Tus solicitudes')).toBeInTheDocument();
  });

  it('un reintento de lo mismo reutiliza la llave para no duplicar la solicitud', async () => {
    const user = userEvent.setup();
    const createRequest = vi
      .fn<HotelClient['createRequest']>()
      .mockRejectedValueOnce(new VaiinillaApiError(0, { code: 'BACKEND_UNAVAILABLE', message: 'Sin red' }))
      .mockResolvedValueOnce(request({ id: 'r9', type: 'limpieza', quantity: 1 }));
    renderHotel('/e/hotel-sol/hotel/solicitudes', makeClient({ createRequest }));
    await user.click(await screen.findByRole('button', { name: /Limpieza/ }));
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud · 1' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('no está disponible');
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud · 1' }));
    await waitFor(() => expect(createRequest).toHaveBeenCalledTimes(2));
    expect(createRequest.mock.calls[0]?.[3]).toBe(createRequest.mock.calls[1]?.[3]);
  });

  it('cancela una solicitud pendiente', async () => {
    const user = userEvent.setup();
    const client = makeClient({ myRequests: vi.fn(() => Promise.resolve([request(), request({ id: 'r2', type: 'limpieza', status: 'resuelta' })])) });
    renderHotel('/e/hotel-sol/hotel/solicitudes', client);
    await user.click(await screen.findByRole('button', { name: 'Cancelar Toallas' }));
    await waitFor(() => expect(client.cancelRequest).toHaveBeenCalledWith('r1', expect.any(String)));
    await waitFor(() => expect(screen.queryByText('Tus solicitudes')).not.toBeInTheDocument());
  });
});

describe('cuenta y salida (H06)', () => {
  it('muestra lo cargado, la estancia aparte y cómo es la salida', async () => {
    renderHotel('/e/hotel-sol/hotel/cuenta');
    expect(await screen.findByTestId('hotel-account-total')).toHaveTextContent('$250');
    expect(screen.getByText('2× Agua')).toBeInTheDocument();
    expect(screen.getByText('Minibar', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('Estancia (2 noches)')).toBeInTheDocument();
    expect(screen.getByText(/El 11 de nov antes de las 12:00/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Pedir salida tardía · Hasta las 15:00 · \$250 extra/ })).toHaveAttribute(
      'href',
      '/e/hotel-sol/hotel/solicitudes',
    );
    expect(screen.getByRole('note')).toHaveTextContent('Pagas en recepción al salir');
  });

  it('una estancia cerrada muestra lo cobrado', async () => {
    renderHotel('/e/hotel-sol/hotel/cuenta', makeClient({ myStay: vi.fn(() => Promise.resolve(stay({ estado: 'salio', total_cobrado: '2730.00' }))) }));
    expect(await screen.findByTestId('hotel-account-total')).toHaveTextContent('$2730');
    expect(screen.getByRole('note')).toHaveTextContent('Cuenta cerrada');
  });
});

describe('pedido al cuarto (H03)', () => {
  function fillCart() {
    writeCart({
      slug: 'hotel-sol',
      establishmentName: 'Hotel Sol',
      lines: [
        { productId: 5, quantity: 2, optionIds: [], productName: 'Club sándwich', unitPreview: '120.00', unitCounter: '110.00', imageUrl: null },
      ],
    });
  }

  it('carga el pedido a la habitación con pago_diferido explícito', async () => {
    fillCart();
    const user = userEvent.setup();
    const { client, afterOrder } = renderHotel('/e/hotel-sol/hotel/pedido');
    expect(await screen.findByText('2 × Club sándwich')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Cargar a la habitación 101/ })).toBeChecked();
    // Sin tarjeta en la web del negocio no se ofrece aunque el hotel la tenga encendida.
    expect(screen.queryByRole('radio', { name: /Tarjeta ahora/ })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Nota para la cocina'), 'Sin cebolla');
    await user.click(screen.getByRole('button', { name: 'Pedir · $220' }));

    await waitFor(() => expect(client.createOrder).toHaveBeenCalled());
    expect(vi.mocked(client.createOrder).mock.calls[0]?.[0]).toMatchObject({
      metodo_pago: 'efectivo',
      destino: 'en_espacio',
      espacio_id: 12,
      pago_diferido: true,
      notas_cocina: 'Sin cebolla',
      items: [{ producto_id: 5, cantidad: 2, opcion_ids: [] }],
    });
    expect(afterOrder).toHaveBeenCalledWith({ id: 'o1', folio: 14 }, 'efectivo');
  });

  it('un reintento del cargo a la habitación reutiliza la llave para no cargar dos veces', async () => {
    fillCart();
    const user = userEvent.setup();
    const createOrder = vi
      .fn<HotelClient['createOrder']>()
      .mockRejectedValueOnce(new VaiinillaApiError(0, { code: 'BACKEND_UNAVAILABLE', message: 'Sin red' }))
      .mockResolvedValueOnce({ id: 'o1', folio: 14 } as OrderDetail);
    const { afterOrder } = renderHotel('/e/hotel-sol/hotel/pedido', makeClient({ createOrder }));
    await user.click(await screen.findByRole('button', { name: 'Pedir · $220' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pedir · $220' }));
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(2));
    expect(createOrder.mock.calls[0]?.[1]).toBe(createOrder.mock.calls[1]?.[1]);
    expect(createOrder.mock.calls[1]?.[0]).toMatchObject({ metodo_pago: 'efectivo', pago_diferido: true, espacio_id: 12 });
    expect(afterOrder).toHaveBeenCalledTimes(1);
  });

  it('con tarjeta manda stripe sin cargo a la cuenta', async () => {
    fillCart();
    const user = userEvent.setup();
    const { client } = renderHotel('/e/hotel-sol/hotel/pedido', makeClient(), { cardOffered: true });
    await user.click(await screen.findByRole('radio', { name: /Tarjeta ahora/ }));
    await user.click(screen.getByRole('button', { name: 'Pedir · $240' }));
    await waitFor(() => expect(client.createOrder).toHaveBeenCalled());
    expect(vi.mocked(client.createOrder).mock.calls[0]?.[0]).toMatchObject({ metodo_pago: 'stripe', pago_diferido: false });
  });

  it('compuerta de Stripe: fuera de modo prueba no ofrece tarjeta y solo carga a la habitación', async () => {
    fillCart();
    const user = userEvent.setup();
    const { client } = renderHotel('/e/hotel-sol/hotel/pedido', makeClient(), { cardOffered: true, stripeTestMode: false });
    expect(await screen.findByRole('radio', { name: /Cargar a la habitación 101/ })).toBeChecked();
    expect(screen.queryByRole('radio', { name: /Tarjeta ahora/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pedir · $220' }));
    await waitFor(() => expect(client.createOrder).toHaveBeenCalled());
    expect(vi.mocked(client.createOrder).mock.calls[0]?.[0]).toMatchObject({ metodo_pago: 'efectivo', pago_diferido: true });
  });

  it('compuerta de Stripe: fuera de modo prueba y sin cargo a la habitación no se crea ningún pedido', async () => {
    fillCart();
    const client = makeClient({
      myStay: vi.fn(() =>
        Promise.resolve(
          stay({
            ajustes: { cargo_habitacion_activo: false, tarjeta_al_pedir: true, solicitudes_activas: true, no_molestar_activo: true },
          }),
        ),
      ),
    });
    renderHotel('/e/hotel-sol/hotel/pedido', client, { cardOffered: true, stripeTestMode: false });
    expect(await screen.findByText('Este hotel no recibe pedidos desde la app en este momento.')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pedir ·/ })).toBeDisabled();
    expect(client.createOrder).not.toHaveBeenCalled();
  });

  it('compuerta de Stripe: si el servidor responde con clave live no abre el pago', async () => {
    fillCart();
    const user = userEvent.setup();
    const liveOrder = {
      id: 'o9',
      folio: 15,
      pago: {
        payment_attempt_id: 'pa_1',
        payment_intent_id: 'pi_1',
        stripe_account_id: 'acct_1',
        payment_status: 'pendiente_pago',
        publishable_key: 'pk_live_ejemplo',
      },
    } as unknown as OrderDetail;
    const client = makeClient({ createOrder: vi.fn(() => Promise.resolve(liveOrder)) });
    const { afterOrder } = renderHotel('/e/hotel-sol/hotel/pedido', client, { cardOffered: true });
    await user.click(await screen.findByRole('radio', { name: /Tarjeta ahora/ }));
    await user.click(screen.getByRole('button', { name: 'Pedir · $240' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('solo funciona en modo de prueba');
    expect(afterOrder).not.toHaveBeenCalled();
  });

  it('si el servidor ya no ve la estancia, vuelve a pedir el código', async () => {
    fillCart();
    const user = userEvent.setup();
    const client = makeClient({
      createOrder: vi.fn(() => Promise.reject(new VaiinillaApiError(403, { code: 'ROOM_REQUIRES_STAY', message: 'x' }))),
    });
    renderHotel('/e/hotel-sol/hotel/pedido', client);
    await user.click(await screen.findByRole('button', { name: 'Pedir · $220' }));
    expect(await screen.findByLabelText('Código de estancia')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/e/hotel-sol/hotel/codigo');
  });

  it('con el carrito vacío lleva al menú', async () => {
    renderHotel('/e/hotel-sol/hotel/pedido');
    expect(await screen.findByRole('link', { name: 'Ver el menú' })).toHaveAttribute('href', '/e/hotel-sol');
  });
});

describe('carrito de una habitación', () => {
  function renderCart() {
    render(
      <MemoryRouter initialEntries={['/e/hotel-sol/carrito']}>
        <Routes>
          <Route path="/e/:slug/carrito" element={<CartRoute><p>Carrito de siempre</p></CartRoute>} />
          <Route path="/e/:slug/hotel/pedido" element={<p>Pedido al cuarto</p>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('en una habitación el carrito lleva al pedido al cuarto', () => {
    rememberSpace(ROOM);
    renderCart();
    expect(screen.getByText('Pedido al cuarto')).toBeInTheDocument();
  });

  it('en una mesa el carrito es el de siempre', () => {
    rememberSpace({ ...ROOM, esHabitacion: undefined, nombre: 'Mesa 4' });
    renderCart();
    expect(screen.getByText('Carrito de siempre')).toBeInTheDocument();
  });

  it('con VITE_FEATURE_HOTEL apagada, aun en una habitación el carrito es el de siempre', () => {
    vi.stubEnv('VITE_FEATURE_HOTEL', 'false');
    rememberSpace(ROOM);
    renderCart();
    expect(screen.getByText('Carrito de siempre')).toBeInTheDocument();
  });
});
