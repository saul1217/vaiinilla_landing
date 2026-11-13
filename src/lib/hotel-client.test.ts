import { afterEach, describe, expect, it, vi } from 'vitest';
import { VaiinillaApiError } from './api-error';
import { createHotelClient, isQrToken } from './hotel-client';

const STAY = {
  id: 'st-1',
  estado: 'en_casa',
  espacio_id: 12,
  espacio_nombre: 'Habitación 101',
  entrada: '2026-11-09',
  salida: '2026-11-11',
  noches: 2,
};

function ok(data: unknown, status = 200) {
  return new Response(JSON.stringify({ data, meta: {}, error: null }), { status });
}

function fail(status: number, code: string) {
  return new Response(JSON.stringify({ data: null, meta: {}, error: { code, message: code } }), { status });
}

function stubFetch(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function call(fetchMock: ReturnType<typeof stubFetch>, index = 0) {
  const [url, init] = fetchMock.mock.calls[index]!;
  const headers = new Headers(init?.headers);
  const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined;
  return { url: typeof url === 'string' ? url : url instanceof URL ? url.href : url.url, method: init?.method ?? 'GET', headers, body };
}

afterEach(() => vi.unstubAllGlobals());

describe('cliente del huésped de hotel', () => {
  it('cada llamada pide la sesión y manda Authorization (también la de invitado renovada)', async () => {
    const fetchMock = stubFetch(ok(STAY), ok([]));
    const tokens = ['tok-1', 'tok-2'];
    const getToken = vi.fn(() => Promise.resolve(tokens.shift()!));
    const client = createHotelClient(getToken);
    await client.myStay(12);
    await client.myRequests();
    expect(getToken).toHaveBeenCalledTimes(2);
    expect(call(fetchMock, 0).headers.get('Authorization')).toBe('Bearer tok-1');
    expect(call(fetchMock, 0).url).toContain('/estancias/mia?espacio_id=12');
    expect(call(fetchMock, 1).headers.get('Authorization')).toBe('Bearer tok-2');
  });

  it('sin estancia ligada (404) es «todavía no hay», no un error', async () => {
    stubFetch(fail(404, 'NOT_FOUND'));
    await expect(createHotelClient(() => Promise.resolve('t')).myStay()).resolves.toBeNull();
  });

  it('sin permiso (401/403) el error llega a la pantalla y no se toma como «sin estancia»', async () => {
    stubFetch(fail(403, 'FORBIDDEN'));
    await expect(createHotelClient(() => Promise.resolve('t')).myStay()).rejects.toMatchObject({ status: 403 });
    stubFetch(fail(401, 'UNAUTHORIZED'));
    await expect(createHotelClient(() => Promise.resolve('t')).myStay()).rejects.toBeInstanceOf(VaiinillaApiError);
  });

  it('vincula con el QR de la puerta; sin QR válido usa el id de la habitación, nunca los dos', async () => {
    const fetchMock = stubFetch(ok(STAY), ok(STAY));
    const client = createHotelClient(() => Promise.resolve('t'));
    await client.linkStay(' 123456 ', { qrToken: 'esp_puerta101', roomId: 12 });
    expect(call(fetchMock, 0)).toMatchObject({ method: 'POST', body: { codigo: '123456', qr_token: 'esp_puerta101' } });
    expect(call(fetchMock, 0).body).not.toHaveProperty('espacio_id');
    await client.linkStay('123456', { qrToken: '4821', roomId: 12 });
    expect(call(fetchMock, 1).body).toEqual({ codigo: '123456', espacio_id: 12 });
    expect(isQrToken('4821')).toBe(false);
  });

  it('un código que no corresponde a la habitación devuelve el error del servidor', async () => {
    stubFetch(fail(404, 'STAY_NOT_FOUND'));
    await expect(createHotelClient(() => Promise.resolve('t')).linkStay('000000', { roomId: 12 })).rejects.toMatchObject({
      status: 404,
      code: 'STAY_NOT_FOUND',
    });
  });

  it('solicitudes, cancelaciones y pedidos mandan la Idempotency-Key que se les da', async () => {
    const fetchMock = stubFetch(
      ok({ id: 'r1', tipo: 'toallas', cantidad: 2, estado: 'pendiente' }, 201),
      ok({ id: 'r1', tipo: 'toallas', cantidad: 2, estado: 'cancelada' }),
      ok({ id: 'o1', folio: 14 }, 201),
    );
    const client = createHotelClient(() => Promise.resolve('t'));
    await client.createRequest('toallas', 2, '  ', 'llave-sol');
    await client.cancelRequest('r1', 'llave-cancel');
    await client.createOrder(
      { establecimiento_slug: 'hotel-sol', metodo_pago: 'efectivo', destino: 'en_espacio', espacio_id: 12, pago_diferido: true, items: [] } as never,
      'llave-pedido',
    );
    expect(call(fetchMock, 0)).toMatchObject({ method: 'POST', body: { tipo: 'toallas', cantidad: 2 } });
    expect(call(fetchMock, 0).body).not.toHaveProperty('nota');
    expect(call(fetchMock, 0).headers.get('Idempotency-Key')).toBe('llave-sol');
    expect(call(fetchMock, 1).url).toContain('/solicitudes-hotel/r1/cancelaciones');
    expect(call(fetchMock, 1).headers.get('Idempotency-Key')).toBe('llave-cancel');
    expect(call(fetchMock, 2).url).toContain('/pedidos');
    expect(call(fetchMock, 2).headers.get('Idempotency-Key')).toBe('llave-pedido');
    expect(call(fetchMock, 2).body).toMatchObject({ metodo_pago: 'efectivo', espacio_id: 12, pago_diferido: true });
  });
});
