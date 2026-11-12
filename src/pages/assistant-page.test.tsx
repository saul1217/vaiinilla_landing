import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CartProvider, useCart } from '../context/cart-context';
import { VaiinillaApiError } from '../lib/api-error';
import type { AssistantReply, AssistantTurn } from '../lib/customer-assistant';
import { rememberSpace } from '../lib/space-session';
import type { CatalogResponse, PublicEstablishment } from '../types/api';
import { AssistantPage, type AssistantPageDeps } from './assistant-page';

const authState: { user: { uid: string; displayName: string } | null } = { user: null };

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: authState.user, ready: true, configured: true, signOut: vi.fn() }),
}));

vi.mock('../context/buyer-session', () => ({
  useBuyerSession: () => ({ context: null, openClientSession: vi.fn() }),
}));

const place: PublicEstablishment = {
  id: '5',
  nombre: 'Café Demo',
  slug: 'demo',
  identificador_cliente_etiqueta: 'Matrícula',
  identificador_cliente_obligatorio: false,
  asistente_clientes: true,
};

const catalog: CatalogResponse = {
  categorias: [{ id: 1, nombre: 'Bebidas', orden: 1 }],
  productos: [
    {
      id: 10,
      categoria_id: 1,
      estacion_preparacion: 'caja',
      nombre: 'Chocolate',
      descripcion: null,
      ingredientes: null,
      alergenos: null,
      tiempo_estimado_min: 4,
      precio_mostrador: '40.00',
      precio_digital: '38.00',
      disponible: true,
      imagen_url: null,
      grupos_opcion: [],
    },
    {
      id: 11,
      categoria_id: 1,
      estacion_preparacion: 'cocina',
      nombre: 'Burrito',
      descripcion: null,
      ingredientes: null,
      alergenos: null,
      tiempo_estimado_min: 10,
      precio_mostrador: '90.00',
      precio_digital: '85.00',
      disponible: true,
      imagen_url: null,
      grupos_opcion: [{ id: 1, nombre: 'Salsa', min_selecciones: 1, max_selecciones: 1, opciones: [{ id: 4, nombre: 'Roja', precio_extra: '0.00' }] }],
    },
  ] as CatalogResponse['productos'],
};

const card = (productId: number, name: string, needsOptions = false) => ({
  productId,
  name,
  price: productId === 10 ? '38.00' : '85.00',
  imageUrl: null,
  available: true,
  needsOptions,
  minutes: null,
});

const reply = (overrides: Partial<AssistantReply> = {}): AssistantReply => ({
  message: 'Te recomiendo el chocolate.',
  products: [],
  order: null,
  waiter: null,
  options: [],
  remainingMessages: 30,
  courts: [],
  ...overrides,
});

function CartProbe() {
  const { cart } = useCart();
  return <output data-testid="cart">{JSON.stringify(cart?.lines.map((l) => [l.productId, l.quantity, l.notes ?? null]) ?? [])}</output>;
}

function Where({ label = 'Menú' }: { label?: string }) {
  const location = useLocation();
  return <p>{`${label} ${JSON.stringify(location.state)}`}</p>;
}

function renderPage(deps: AssistantPageDeps) {
  const full: AssistantPageDeps = {
    enabled: true,
    loadPlace: () => Promise.resolve({ place, catalog }),
    token: () => Promise.resolve('tok'),
    ...deps,
  };
  return render(
    <MemoryRouter initialEntries={['/e/demo/asistente']}>
      <CartProvider>
        <Routes>
          <Route path="/e/:slug/asistente" element={<><AssistantPage deps={full} /><CartProbe /></>} />
          <Route path="/e/:slug/carrito" element={<p>Carrito</p>} />
          <Route path="/e/:slug" element={<Where />} />
          <Route path="/e/:slug/canchas" element={<Where label="Canchas" />} />
        </Routes>
      </CartProvider>
    </MemoryRouter>,
  );
}

describe('AssistantPage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    authState.user = { uid: 'u1', displayName: 'Ana López' };
  });

  it('con la bandera apagada no existe', async () => {
    renderPage({ enabled: false });
    expect(await screen.findByText('El asistente no está disponible aquí')).toBeInTheDocument();
    expect(screen.queryByLabelText('Pregunta o pide lo que quieras')).not.toBeInTheDocument();
  });

  it('si la tienda lo apagó para clientes no existe', async () => {
    renderPage({ loadPlace: () => Promise.resolve({ place: { ...place, asistente_clientes: false }, catalog }) });
    expect(await screen.findByText('El asistente no está disponible aquí')).toBeInTheDocument();
  });

  it('manda la plática con el lugar y enseña la respuesta con sus productos', async () => {
    const ask = vi.fn<(token: string, turns: AssistantTurn[], id: string) => Promise<AssistantReply>>(() =>
      Promise.resolve(reply({ products: [card(10, 'Chocolate')], options: ['Algo más'] })),
    );
    const user = userEvent.setup();
    renderPage({ ask });
    expect(await screen.findByText(/hola, ana/i)).toBeInTheDocument();
    expect(screen.getByText(/procesa una IA de otra empresa/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '¿Qué me recomiendas?' }));
    expect(await screen.findByText('Te recomiendo el chocolate.')).toBeInTheDocument();
    expect(ask).toHaveBeenCalledWith('tok', [{ fromCustomer: true, text: '¿Qué me recomiendas?' }], '5');
    await user.click(screen.getByRole('button', { name: 'Agregar Chocolate' }));
    expect(screen.getByTestId('cart')).toHaveTextContent('[[10,1,null]]');
    expect(screen.getByText('Agregado ✓')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /pedir ya, 1 producto/i })).toHaveAttribute('href', '/e/demo/carrito');
    expect(screen.getByRole('button', { name: 'Algo más' })).toBeInTheDocument();
  });

  it('un producto con opciones abre su ficha en el menú, sin escoger por el cliente', async () => {
    const user = userEvent.setup();
    renderPage({ ask: () => Promise.resolve(reply({ products: [card(11, 'Burrito', true)] })) });
    await user.type(await screen.findByLabelText('Pregunta o pide lo que quieras'), 'burrito{Enter}');
    await user.click(await screen.findByRole('button', { name: 'Elegir opciones de Burrito' }));
    expect(await screen.findByText('Menú {"openProductId":11}')).toBeInTheDocument();
  });

  it('pone el pedido propuesto en el carrito, nombra lo que no entró y el siguiente lo reemplaza', async () => {
    const order1 = {
      lines: [
        { product: card(10, 'Chocolate'), quantity: 2, note: null },
        { product: card(11, 'Burrito', true), quantity: 1, note: null },
      ],
      total: '76.00',
      unavailable: ['Flan'],
      toChoose: [],
    };
    const order2 = { lines: [{ product: card(10, 'Chocolate'), quantity: 1, note: null }], total: '38.00', unavailable: [], toChoose: [] };
    const ask = vi.fn().mockResolvedValueOnce(reply({ order: order1 })).mockResolvedValueOnce(reply({ order: order2 }));
    const user = userEvent.setup();
    renderPage({ ask });
    await user.type(await screen.findByLabelText('Pregunta o pide lo que quieras'), 'dos chocolates y un burrito{Enter}');
    expect(await screen.findByText('Ya no hay: Flan')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Agregar al carrito' }));
    expect(screen.getByTestId('cart')).toHaveTextContent('[[10,2,null]]');
    expect(screen.getByText(/No agregué Burrito/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver carrito' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Pregunta o pide lo que quieras'), 'mejor solo uno{Enter}');
    await waitFor(() => expect(screen.getAllByRole('region', { name: 'Pedido propuesto' })).toHaveLength(2));
    // El primero ya entró al carrito: sigue diciendo «Ver carrito»; solo el nuevo se agrega.
    expect(screen.getAllByRole('button', { name: 'Agregar al carrito' })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Agregar al carrito' }));
    // Sin nada que saltar va al carrito; el carrito tiene 1 chocolate (reemplazó los 2).
    expect(await screen.findByText('Carrito')).toBeInTheDocument();
    expect((JSON.parse(localStorage.getItem('vaiinilla.buyer.cart.v1') ?? '{}') as { lines: unknown[] }).lines).toEqual([
      expect.objectContaining({ productId: 10, quantity: 1 }),
    ]);
  });

  it('ASSISTANT_DISABLED cierra la plática sin Reintentar; otro error deja reintentar', async () => {
    const ask = vi
      .fn()
      .mockRejectedValueOnce(new VaiinillaApiError(503, { code: 'ASSISTANT_UNAVAILABLE', message: 'El asistente no está disponible.' }))
      .mockResolvedValueOnce(reply())
      .mockRejectedValueOnce(new VaiinillaApiError(403, { code: 'ASSISTANT_DISABLED', message: 'La tienda apagó el asistente.' }));
    const user = userEvent.setup();
    renderPage({ ask });
    await user.type(await screen.findByLabelText('Pregunta o pide lo que quieras'), 'hola{Enter}');
    expect(await screen.findByText('El asistente no está disponible.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Te recomiendo el chocolate.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Pregunta o pide lo que quieras'), 'otra{Enter}');
    expect(await screen.findByText('La tienda apagó el asistente.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Pregunta o pide lo que quieras')).toBeDisabled();
  });

  it('sin cuenta ni invitado pide el nombre antes de preguntar y luego sigue', async () => {
    authState.user = null;
    const enterAsGuest = vi.fn(() => {
      localStorage.setItem('vaiinilla.buyer.guest.v1', JSON.stringify({ nombre: 'Luis', llave: 'k' }));
      return Promise.resolve();
    });
    const ask = vi.fn(() => Promise.resolve(reply()));
    const user = userEvent.setup();
    renderPage({ token: undefined, ask, enterAsGuest, callWaiter: vi.fn() });
    // Sin deps.token el asistente pide la sesión real: aquí se prueba hasta el nombre.
    await user.type(await screen.findByLabelText('Pregunta o pide lo que quieras'), 'hola{Enter}');
    expect(await screen.findByText('¿Cómo te llamas?')).toBeInTheDocument();
    expect(ask).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Seguir' }));
    expect(screen.getByText('Escribe tu nombre.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Tu nombre'), '  Luis ');
    await user.click(screen.getByRole('button', { name: 'Seguir' }));
    expect(enterAsGuest).toHaveBeenCalledWith('demo', 'Luis');
  });

  it('con mesa escaneada ofrece llamar al mesero con el motivo que sugiere', async () => {
    rememberSpace({ slug: 'demo', espacioId: 42, nombre: 'Mesa 4', tipo: 'mesa' });
    const callWaiter = vi.fn(() => Promise.resolve());
    const user = userEvent.setup();
    renderPage({ ask: () => Promise.resolve(reply({ waiter: { reason: 'utensilios', detail: null } })), callWaiter });
    await user.type(await screen.findByLabelText('Pregunta o pide lo que quieras'), 'servilletas{Enter}');
    expect(await screen.findByText('Motivo: Cubiertos o servilletas')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Llamar' }));
    expect(await screen.findByText('Listo, ya le avisamos. Va para allá.')).toBeInTheDocument();
    expect(callWaiter).toHaveBeenCalledWith('tok', 42, { reason: 'utensilios', detail: null });
  });

  it('sin mesa no ofrece llamar al mesero y las pistas dicen su disponibilidad', async () => {
    const user = userEvent.setup();
    renderPage({
      ask: () => Promise.resolve(reply({
          waiter: { reason: 'atencion', detail: null },
          courts: [{ courtId: 7, name: 'Pádel 1', freeNow: true, freeUntil: '18:00', busyUntil: null, pricePerHour: '250.00', cardPricePerHour: null, capacity: 4 }],
        })),
    });
    await user.type(await screen.findByLabelText('Pregunta o pide lo que quieras'), 'pádel{Enter}');
    expect(await screen.findByText('Libre hasta las 18:00')).toBeInTheDocument();
    expect(screen.getByText('$250 la hora · Hasta 4 personas')).toBeInTheDocument();
    expect(screen.queryByText('Llamar al mesero')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Rentar Pádel 1' }));
    expect(await screen.findByText('Canchas {"courtId":7}')).toBeInTheDocument();
  });

  it('un pedido viejo sin agregar avisa que hay una versión más nueva', async () => {
    const order = { lines: [{ product: card(10, 'Chocolate'), quantity: 1, note: null }], total: '38.00', unavailable: [], toChoose: [] };
    const user = userEvent.setup();
    renderPage({ ask: () => Promise.resolve(reply({ order })) });
    await user.type(await screen.findByLabelText('Pregunta o pide lo que quieras'), 'uno{Enter}');
    await screen.findByRole('region', { name: 'Pedido propuesto' });
    await user.type(screen.getByLabelText('Pregunta o pide lo que quieras'), 'otro{Enter}');
    expect(await screen.findByText('Ya hay una versión más nueva de tu pedido abajo.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Agregar al carrito' })).toHaveLength(1);
  });
});
