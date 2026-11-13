import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { api } from '../lib/api';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const reserva = {
  id: 'r1',
  espacio: { id: 3, nombre: 'Pista 3', tipo: 'cancha' },
  inicio: '2026-11-10T18:00:00.000Z',
  fin: '2026-11-10T19:00:00.000Z',
  duracion_min: 60,
  monto: '200.00',
  estado: 'pendiente_pago',
  jugadores: 4,
};

describe('POST /reservas en un boliche', () => {
  it('manda jugadores cuando se anotaron', async () => {
    let body: unknown = null;
    server.use(
      http.post(`${api.apiUrl}/reservas`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: reserva, meta: {}, error: null }, { status: 201 });
      }),
    );
    const created = await api.createReservation('t', { courtId: 3, start: null, durationMinutes: 60, players: 4 }, 'k1');
    expect(body).toEqual({ espacio_id: 3, duracion_min: 60, jugadores: 4 });
    expect(created.players).toBe(4);
  });

  it('sin jugadores el cuerpo queda como siempre', async () => {
    let body: unknown = null;
    server.use(
      http.post(`${api.apiUrl}/reservas`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: { ...reserva, jugadores: null }, meta: {}, error: null }, { status: 201 });
      }),
    );
    await api.createReservation('t', { courtId: 3, start: Date.parse('2026-11-10T18:00:00Z'), durationMinutes: 60 }, 'k2');
    expect(body).toEqual({ espacio_id: 3, inicio: '2026-11-10T18:00:00.000Z', duracion_min: 60 });
  });
});
