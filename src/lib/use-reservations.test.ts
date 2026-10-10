import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CourtDay, Reservation } from './reservations';
import { canReserve, selectedCourt, useReservations, type ReservationsClient } from './use-reservations';

const MIN = 60_000;
const HOUR = 60 * MIN;
const TODAY = '2026-10-10';
const TOMORROW = '2026-10-11';
const OPEN: Record<string, number> = {
  [TODAY]: Date.parse('2026-10-10T13:00:00Z'),
  [TOMORROW]: Date.parse('2026-10-11T13:00:00Z'),
  '2026-10-24': Date.parse('2026-10-24T13:00:00Z'),
};

function courtDay(date: string): CourtDay {
  const opensAt = OPEN[date];
  return {
    date,
    today: TODAY,
    timeZone: 'America/Chihuahua',
    opensAt,
    closesAt: opensAt + 15 * HOUR,
    blockMinutes: 30,
    durations: [60, 90],
    daysAhead: 14,
    holdMinutes: 10,
    now: OPEN[TODAY] + HOUR,
    courts: [
      {
        id: 2,
        name: 'Cancha 2',
        pricePerHour: '400.00',
        customerPricePerHour: null,
        rentable: true,
        busy: [],
        profile: { description: null, imageUrl: null, features: [] },
      },
    ],
  };
}

function reservation(start: number, durationMinutes: number): Reservation {
  return {
    id: 'r1',
    courtId: 2,
    courtName: 'Cancha 2',
    start,
    end: start + durationMinutes * MIN,
    durationMinutes,
    amount: '600.00',
    customerPrice: null,
    state: 'pendiente_pago',
    holdExpiresAt: null,
    orderId: null,
    channel: 'app',
    version: 1,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function fakeClient(day: ReservationsClient['day']) {
  const create = vi.fn<ReservationsClient['create']>(async (input) =>
    reservation(input.start ?? 0, input.durationMinutes),
  );
  const client: ReservationsClient = {
    day,
    list: async () => [],
    create,
    pay: vi.fn(),
    cancel: async () => reservation(0, 60),
  };
  return { client, create };
}

async function mount(client: ReservationsClient) {
  const hook = renderHook(() => useReservations(client, () => undefined));
  await waitFor(() => expect(hook.result.current.state.day?.date).toBe(TODAY));
  return hook;
}

describe('cambio de día y apartar', () => {
  it('pide al servidor el día elegido, no el anterior', async () => {
    const day = vi.fn(async (date?: string) => courtDay(date ?? TODAY));
    const { client } = fakeClient(day);
    const { result } = await mount(client);

    act(() => result.current.selectDate(TOMORROW));

    expect(day).toHaveBeenLastCalledWith(TOMORROW);
    await waitFor(() => expect(result.current.state.day?.date).toBe(TOMORROW));
  });

  it('mientras llega la lista de mañana no se puede apartar con la de hoy', async () => {
    const pending = deferred<CourtDay>();
    const day = vi.fn((date?: string) => (date ? pending.promise : Promise.resolve(courtDay(TODAY))));
    const { client, create } = fakeClient(day);
    const { result } = await mount(client);

    act(() => result.current.selectDate(TOMORROW));

    // Sigue la lista de hoy en memoria, pero ya no es elegible.
    expect(result.current.state.day?.date).toBe(TODAY);
    expect(selectedCourt(result.current.state)).toBeNull();
    expect(canReserve(result.current.state)).toBe(false);
    await act(() => result.current.reserve());
    expect(create).not.toHaveBeenCalled();

    await act(async () => pending.resolve(courtDay(TOMORROW)));
    expect(selectedCourt(result.current.state)?.id).toBe(2);
  });

  it('apartar justo después de elegir mañana guarda el inicio de mañana', async () => {
    const day = vi.fn(async (date?: string) => courtDay(date ?? TODAY));
    const { client, create } = fakeClient(day);
    const { result } = await mount(client);

    act(() => result.current.selectDate(TOMORROW));
    await waitFor(() => expect(result.current.state.day?.date).toBe(TOMORROW));
    const start = OPEN[TOMORROW] + 3 * HOUR;
    act(() => result.current.selectStart(start));
    act(() => result.current.selectDuration(90));
    await act(() => result.current.reserve());

    expect(create).toHaveBeenCalledWith({ courtId: 2, start, durationMinutes: 90 }, expect.any(String));
  });

  it('Hoy → Mañana → Hoy y el día +14 piden su propia fecha', async () => {
    const day = vi.fn(async (date?: string) => courtDay(date ?? TODAY));
    const { client } = fakeClient(day);
    const { result } = await mount(client);

    act(() => result.current.selectDate(TOMORROW));
    await waitFor(() => expect(result.current.state.day?.date).toBe(TOMORROW));
    act(() => result.current.selectDate(TODAY));
    expect(result.current.state.selectedDate).toBeNull();
    expect(day).toHaveBeenLastCalledWith(undefined);
    await waitFor(() => expect(result.current.state.day?.date).toBe(TODAY));
    act(() => result.current.selectDate('2026-10-24'));
    expect(day).toHaveBeenLastCalledWith('2026-10-24');
    await waitFor(() => expect(result.current.state.day?.date).toBe('2026-10-24'));
  });

  it('una respuesta que llega fuera de orden no reemplaza la lista del día elegido', async () => {
    const slowToday = deferred<CourtDay>();
    let calls = 0;
    const day = vi.fn((date?: string) => {
      if (date) return Promise.resolve(courtDay(date));
      calls += 1;
      return calls === 1 ? Promise.resolve(courtDay(TODAY)) : slowToday.promise;
    });
    const { client } = fakeClient(day);
    const { result } = await mount(client);

    // Un refresco de hoy queda en vuelo (p. ej. la consulta automática)...
    let inFlight!: Promise<void>;
    await act(async () => {
      inFlight = result.current.cancel(reservation(0, 60)); // termina con un refresh() de hoy
    });
    expect(calls).toBe(2);
    await act(async () => {
      result.current.selectDate(TOMORROW);
    });
    await waitFor(() => expect(result.current.state.day?.date).toBe(TOMORROW));
    // ...y responde tarde, con la lista de hoy.
    await act(async () => {
      slowToday.resolve(courtDay(TODAY));
      await inFlight;
    });

    expect(result.current.state.day?.date).toBe(TOMORROW);
  });
});
