import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourtDay, CourtSchedule, Reservation, ReservationPayment } from '../lib/reservations';
import type { ReservationsClient } from '../lib/use-reservations';
import { VaiinillaApiError } from '../lib/api-error';
import { ReservationsScreen } from '../pages/reservations-page';

const MIN = 60_000;
const T0 = Date.parse('2026-11-10T16:00:00Z'); // 10:00 en Chihuahua
const NOW = T0 + 100 * MIN; // el primer inicio de hoy es 12:00

function lane(id: number, capacity: number | null, durations: number[] = []): CourtSchedule {
  return {
    id,
    name: `Pista ${id}`,
    pricePerHour: '200.00',
    customerPricePerHour: { card: '200.00', cashOrBalance: '200.00' },
    rentable: true,
    busy: [],
    profile: { description: null, imageUrl: null, features: [] },
    capacity,
    durations,
  };
}

function bowlingDay(courts: CourtSchedule[], extra: Partial<CourtDay> = {}): CourtDay {
  return {
    date: '2026-11-10',
    today: '2026-11-10',
    timeZone: 'America/Chihuahua',
    opensAt: T0,
    closesAt: T0 + 13 * 60 * MIN,
    blockMinutes: 30,
    durations: [60, 120, 180],
    daysAhead: 14,
    holdMinutes: 10,
    now: NOW,
    courts,
    bowling: true,
    closed: false,
    ...extra,
  };
}

function reservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 'r1',
    courtId: 1,
    courtName: 'Pista 1',
    start: NOW,
    end: NOW + 60 * MIN,
    durationMinutes: 60,
    amount: '200.00',
    customerPrice: { card: '200.00', cashOrBalance: '200.00' },
    state: 'pendiente_pago',
    holdExpiresAt: Date.now() + 10 * MIN,
    orderId: null,
    channel: 'cliente',
    version: 1,
    players: 3,
    ...overrides,
  };
}

function makeClient(courts: CourtSchedule[], extra: Partial<CourtDay> = {}): ReservationsClient {
  return {
    day: vi.fn(() => Promise.resolve(bowlingDay(courts, extra))),
    list: vi.fn(() => Promise.resolve([] as Reservation[])),
    create: vi.fn(() => Promise.resolve(reservation())),
    pay: vi.fn((): Promise<ReservationPayment> => Promise.resolve({ reservation: reservation({ state: 'confirmada' }), order: null })),
    cancel: vi.fn(() => Promise.resolve(reservation({ state: 'cancelada' }))),
  };
}

function renderScreen(client: ReservationsClient) {
  return render(
    <MemoryRouter initialEntries={['/e/boliche/canchas']}>
      <Routes>
        <Route path="/e/:slug/canchas" element={<ReservationsScreen client={client} slug="boliche" cardOffered />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Reservas de boliche (bandera prendida)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('habla de pistas y no aparta sin saber cuántos juegan', async () => {
    const user = userEvent.setup();
    const client = makeClient([lane(1, 6)]);
    renderScreen(client);
    expect(await screen.findByRole('radiogroup', { name: 'Pista' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '12:00' }));
    const reserve = await screen.findByRole('button', { name: 'Apartar pista' });
    expect(reserve).toBeDisabled();
    expect(screen.getByText('¿Cuántos van a jugar?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Un jugador más' }));
    expect(reserve).toBeEnabled();
  });

  it('manda los jugadores al apartar y la hoja de pago los muestra', async () => {
    const user = userEvent.setup();
    const client = makeClient([lane(1, 6)]);
    renderScreen(client);
    await user.click(await screen.findByRole('button', { name: /rentar ahora/i }));
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: 'Un jugador más' }));
    await user.click(screen.getByRole('button', { name: 'Apartar pista' }));
    await waitFor(() => expect(client.create).toHaveBeenCalled());
    expect(vi.mocked(client.create).mock.calls[0]?.[0]).toEqual({ courtId: 1, start: null, durationMinutes: 60, players: 3 });
    expect(await screen.findByRole('heading', { name: 'Paga tu pista' })).toBeInTheDocument();
    expect(screen.getAllByText(/3 jugadores/).length).toBeGreaterThan(0);
  });

  it('no deja pasar de la capacidad de la pista', async () => {
    const user = userEvent.setup();
    renderScreen(makeClient([lane(1, 2)]));
    await user.click(await screen.findByRole('radio', { name: '12:00' }));
    const more = screen.getByRole('button', { name: 'Un jugador más' });
    await user.click(more);
    await user.click(more);
    expect(more).toBeDisabled();
    expect(screen.getByText('Caben hasta 2 en esta pista.')).toBeInTheDocument();
  });

  it('al cambiar a una pista más chica ajusta los jugadores a su tope', async () => {
    const user = userEvent.setup();
    const client = makeClient([lane(1, 6), lane(2, 2)]);
    renderScreen(client);
    await user.click(await screen.findByRole('radio', { name: '12:00' }));
    for (let i = 0; i < 5; i++) await user.click(screen.getByRole('button', { name: 'Un jugador más' }));
    expect(screen.getByLabelText('5 jugadores')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /pista 2/i }));
    await user.click(screen.getByRole('radio', { name: '12:00' }));
    expect(screen.getByLabelText('2 jugadores')).toBeInTheDocument();
  });

  it('ofrece solo las duraciones de la pista', async () => {
    const user = userEvent.setup();
    renderScreen(makeClient([lane(1, 6, [120, 180])]));
    await user.click(await screen.findByRole('radio', { name: '12:00' }));
    const durations = screen.getByRole('radiogroup', { name: 'Duración' });
    expect(durations).toHaveTextContent('2 h');
    expect(durations).toHaveTextContent('3 h');
    expect(durations).not.toHaveTextContent('1 h');
  });

  it('avisa cuando el día no se rentan pistas', async () => {
    renderScreen(makeClient([lane(1, 6)], { closed: true }));
    expect(await screen.findByText('Este día no se rentan pistas. Elige otro día.')).toBeInTheDocument();
  });

  it('un 5xx al apartar se explica con la palabra pista', async () => {
    const user = userEvent.setup();
    const client = makeClient([lane(1, 6)]);
    client.create = vi.fn(() => Promise.reject(new VaiinillaApiError(503, { code: 'INTERNAL_ERROR', message: 'x' })));
    renderScreen(client);
    await user.click(await screen.findByRole('button', { name: /rentar ahora/i }));
    await user.click(screen.getByRole('button', { name: 'Un jugador más' }));
    await user.click(screen.getByRole('button', { name: 'Apartar pista' }));
    expect(await screen.findByText(/No pudimos apartar la pista/)).toBeInTheDocument();
  });

  it('sin la bandera (día sin bowling) no pide jugadores ni dice pista', async () => {
    const user = userEvent.setup();
    const client = makeClient([lane(1, 6)], { bowling: undefined, closed: undefined });
    renderScreen(client);
    await user.click(await screen.findByRole('radio', { name: '12:00' }));
    expect(screen.getByRole('button', { name: 'Apartar cancha' })).toBeEnabled();
    expect(screen.queryByText('¿Cuántos van a jugar?')).not.toBeInTheDocument();
  });
});
