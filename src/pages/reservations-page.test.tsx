import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourtDay, CourtSchedule, Reservation, ReservationPayment } from '../lib/reservations';
import type { ReservationsClient } from '../lib/use-reservations';
import { ReservationsScreen } from './reservations-page';

const MIN = 60_000;
const T0 = Date.parse('2026-09-30T13:00:00Z'); // 07:00 en Chihuahua
const NOW = T0 + 100 * MIN; // 08:40: el primer inicio de hoy es 09:00

function court(id: number, name: string, busy: Array<[number, number]> = [], extra: Partial<CourtSchedule> = {}): CourtSchedule {
  return {
    id,
    name,
    pricePerHour: '300.00',
    customerPricePerHour: { card: '300.00', cashOrBalance: '330.00' },
    rentable: true,
    busy: busy.map(([s, e]) => ({ start: T0 + s * MIN, end: T0 + e * MIN, reason: 'reserva' })),
    profile: { description: null, imageUrl: null, features: [] },
    ...extra,
  };
}

function day(courts: CourtSchedule[]): CourtDay {
  return {
    date: '2026-09-30',
    today: '2026-09-30',
    timeZone: 'America/Chihuahua',
    opensAt: T0,
    closesAt: T0 + 16 * 60 * MIN,
    blockMinutes: 30,
    durations: [60, 90, 120],
    daysAhead: 14,
    holdMinutes: 10,
    now: NOW,
    courts,
  };
}

function reservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 'r1',
    courtId: 7,
    courtName: 'Cancha 1',
    start: T0 + 120 * MIN,
    end: T0 + 180 * MIN,
    durationMinutes: 60,
    amount: '300.00',
    customerPrice: { card: '300.00', cashOrBalance: '330.00' },
    state: 'pendiente_pago',
    holdExpiresAt: Date.now() + 10 * MIN,
    orderId: null,
    channel: 'cliente',
    version: 1,
    ...overrides,
  };
}

function makeClient(overrides: Partial<ReservationsClient> = {}, courts?: CourtSchedule[]): ReservationsClient {
  const list = courts ?? [court(7, 'Cancha 1'), court(8, 'Cancha 2', [[60, 400]])];
  return {
    day: vi.fn(() => Promise.resolve(day(list))),
    list: vi.fn(() => Promise.resolve([] as Reservation[])),
    create: vi.fn(() => Promise.resolve(reservation())),
    pay: vi.fn((): Promise<ReservationPayment> => Promise.resolve({ reservation: reservation({ state: 'confirmada' }), order: null })),
    cancel: vi.fn(() => Promise.resolve(reservation({ state: 'cancelada' }))),
    ...overrides,
  };
}

function renderScreen(client: ReservationsClient) {
  return render(
    <MemoryRouter initialEntries={['/e/padel/canchas']}>
      <Routes>
        <Route path="/e/:slug/canchas" element={<ReservationsScreen client={client} slug="padel" />} />
        <Route path="/cuenta/pedidos/:id" element={<p>Pedido de renta</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ReservationsScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('muestra las canchas con su precio al cliente y cuándo se liberan', async () => {
    renderScreen(makeClient());
    expect(await screen.findByRole('radio', { name: /cancha 1/i })).toBeInTheDocument();
    expect(screen.getAllByText('$330 / hora')).toHaveLength(2);
    expect(screen.getByText(/libre ahora/i)).toBeInTheDocument();
    // La cancha 2 está ocupada de 08:00 a 13:40 y "ahora" son las 08:40.
    expect(screen.getByText(/se libera 13:40/i)).toBeInTheDocument();
  });

  it('elige hora y duración, aparta y paga con saldo; el pedido de renta abre su pantalla', async () => {
    const user = userEvent.setup();
    const client = makeClient({
      pay: vi.fn(() =>
        Promise.resolve({
          reservation: reservation({ state: 'confirmada' }),
          order: { id: 'p77', qr_token: null } as unknown as ReservationPayment['order'],
        }),
      ),
    });
    renderScreen(client);
    await user.click(await screen.findByRole('radio', { name: '09:00' }));
    expect(await screen.findByText(/09:00 – 10:00/)).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '1 h 30' }));
    expect(await screen.findByText(/09:00 – 10:30/)).toBeInTheDocument();
    expect(screen.getByLabelText('Resumen de tu renta')).toHaveTextContent('495.00');

    await user.click(screen.getByRole('button', { name: /apartar cancha/i }));
    await waitFor(() =>
      expect(client.create).toHaveBeenCalledWith(
        { courtId: 7, start: T0 + 120 * MIN, durationMinutes: 90 },
        expect.any(String),
      ),
    );
    const sheet = await screen.findByRole('dialog', { name: /paga tu cancha/i });
    expect(within(sheet).getByText(/apartada por 9:5\d/i)).toBeInTheDocument();
    expect(within(sheet).getAllByText('$330', { selector: 'b' })).toHaveLength(2);
    expect(within(sheet).getByText('$300', { selector: 'b' })).toBeInTheDocument();

    await user.click(within(sheet).getByRole('button', { name: /saldo/i }));
    await waitFor(() => expect(client.pay).toHaveBeenCalledWith('r1', 'saldo', expect.any(String)));
    expect(await screen.findByText('Pedido de renta')).toBeInTheDocument();
  });

  it('"Rentar ahora" aparta sin hora de inicio', async () => {
    const user = userEvent.setup();
    const client = makeClient();
    renderScreen(client);
    await user.click(await screen.findByRole('button', { name: /rentar ahora/i }));
    expect(await screen.findByText(/ahora – /i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /apartar cancha/i }));
    await waitFor(() => expect(client.create).toHaveBeenCalled());
    expect(vi.mocked(client.create).mock.calls[0]?.[0]).toEqual({ courtId: 7, start: null, durationMinutes: 60 });
  });

  it('una hora ocupada no se puede elegir y una cancha ocupada no ofrece rentar ahora', async () => {
    const user = userEvent.setup();
    renderScreen(makeClient());
    await user.click(await screen.findByRole('radio', { name: /cancha 2/i }));
    expect(screen.queryByRole('button', { name: /rentar ahora/i })).not.toBeInTheDocument();
    expect(await screen.findByRole('radio', { name: '09:00' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: '14:00' })).toBeEnabled();
  });

  it('si apartar falla lo dice y no abre el pago', async () => {
    const user = userEvent.setup();
    const client = makeClient({ create: vi.fn(() => Promise.reject(new Error('Ese horario ya lo tomaron.'))) });
    renderScreen(client);
    await user.click(await screen.findByRole('radio', { name: '09:00' }));
    await user.click(await screen.findByRole('button', { name: /apartar cancha/i }));
    expect(await screen.findByText(/ya lo tomaron/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /paga tu cancha/i })).not.toBeInTheDocument();
  });

  it('retoma el pago de una reserva apartada y cancela con confirmación', async () => {
    const user = userEvent.setup();
    const pending = reservation();
    const client = makeClient({ list: vi.fn(() => Promise.resolve([pending])) });
    renderScreen(client);
    const mine = await screen.findByRole('heading', { name: /mis reservas/i });
    expect(mine).toBeInTheDocument();
    expect(screen.getByText('Esperando pago')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^cancelar$/i }));
    expect(await screen.findByText(/no se te cobra nada/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /sí, cancelar/i }));
    await waitFor(() => expect(client.cancel).toHaveBeenCalledWith('r1', expect.any(String)));
    expect(await screen.findByText(/reserva cancelada/i)).toBeInTheDocument();
  });

  it('al cancelar la tarjeta deja de verse al instante, sin esperar otro refresco', async () => {
    const user = userEvent.setup();
    const pending = reservation();
    let calls = 0;
    const client = makeClient({
      // La primera lectura trae la reserva; el refresco que sigue a cancelar tarda (backend lento).
      list: vi.fn(() => (calls++ === 0 ? Promise.resolve([pending]) : new Promise<Reservation[]>(() => undefined))),
    });
    renderScreen(client);
    await user.click(await screen.findByRole('button', { name: /^cancelar$/i }));
    await user.click(await screen.findByRole('button', { name: /sí, cancelar/i }));
    await screen.findByText(/reserva cancelada/i);
    expect(screen.queryByRole('heading', { name: /mis reservas/i })).not.toBeInTheDocument();
  });

  it('una reserva pagada avisa que lo pagado no se devuelve al cancelar', async () => {
    const user = userEvent.setup();
    const paid = reservation({ state: 'confirmada', holdExpiresAt: null, start: Date.now() + 5 * 60 * MIN });
    renderScreen(makeClient({ list: vi.fn(() => Promise.resolve([paid])) }));
    await user.click(await screen.findByRole('button', { name: /^cancelar$/i }));
    expect(await screen.findByText(/lo que pagaste no se devuelve/i)).toBeInTheDocument();
  });

  it('muestra la ficha de la cancha y abre la foto en grande', async () => {
    const user = userEvent.setup();
    const client = makeClient({}, [
      court(7, 'Cancha 1', [], {
        profile: { description: 'Techada con cristal.', imageUrl: 'https://x/cancha.jpg', features: ['Techada', 'Con luz'] },
      }),
    ]);
    renderScreen(client);
    expect(await screen.findByText('Techada con cristal.')).toBeInTheDocument();
    expect(screen.getByText('Con luz')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /ver la foto de cancha 1 en grande/i }));
    const big = await screen.findByRole('dialog', { name: /foto de cancha 1/i });
    expect(within(big).getByRole('img')).toHaveAttribute('src', 'https://x/cancha.jpg');
    await user.click(within(big).getByRole('button', { name: /cerrar foto/i }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /foto de cancha 1/i })).not.toBeInTheDocument());
  });

  it('sin canchas con precio dice que se renta en caja', async () => {
    renderScreen(makeClient({}, [court(7, 'Cancha 1', [], { rentable: false })]));
    expect(await screen.findByText(/no se rentan desde la app/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /apartar/i })).not.toBeInTheDocument();
  });
});
