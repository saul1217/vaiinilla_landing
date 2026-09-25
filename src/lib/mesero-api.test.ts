import { afterEach, describe, expect, it, vi } from 'vitest';
import { CallsUnavailableError, createBuyerCallClient, createWaiterClient } from './mesero-api';

const ok = (data: unknown) => new Response(JSON.stringify({ data, meta: {}, error: null }), { status: 200 });
const notFound = () => new Response(JSON.stringify({ data: null, meta: {}, error: { code: 'NOT_FOUND', message: 'No existe' } }), { status: 404 });

afterEach(() => vi.unstubAllGlobals());

describe('createWaiterClient', () => {
  it('arma el tablero con /espacios y /pedidos cuando el backend aún no tiene tablero ni llamadas', async () => {
    const fetchMock = vi.fn((input: string) => {
      const url = input;
      if (url.endsWith('/espacios/tablero') || url.includes('/llamadas')) return Promise.resolve(notFound());
      if (url.endsWith('/espacios')) return Promise.resolve(ok([{ id: 4, nombre: 'Mesa 4', tipo: 'mesa' }, { id: 5, nombre: 'Mesa 5', tipo: 'mesa' }]));
      if (url.includes('/pedidos?estado=listo')) {
        return Promise.resolve(ok([
          {
            id: 'p1', folio: 312, estado: 'listo', version: 3, destino: 'en_espacio', espacio: { id: 4, nombre: 'Mesa 4', tipo: 'mesa' },
            usuario: { nombre: 'Ana', matricula: null }, actualizado_en: '2026-09-25T18:00:00Z',
            items: [{ cantidad: 2, nombre_producto: 'Taco' }],
          },
        ]));
      }
      throw new Error(`inesperado ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const board = await createWaiterClient(() => Promise.resolve('tok')).board();

    expect(board.callsEnabled).toBe(false);
    expect(board.tables).toHaveLength(2);
    expect(board.tables[0]?.pedidos[0]).toMatchObject({ folio: 312, items_resumen: '2× Taco', cliente: { nombre: 'Ana' } });
    expect(board.tables[1]?.pedidos).toHaveLength(0);
  });

  it('entrega con la transición existente y el qr_token del cliente', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(ok({})));
    vi.stubGlobal('fetch', fetchMock);

    await createWaiterClient(() => Promise.resolve('tok')).deliver(
      { id: 'p1', folio: 312, estado: 'listo', version: 3, cliente: null, items_resumen: '', actualizado_en: '' },
      '  abc  ',
    );

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/pedidos/p1/transiciones');
    expect(JSON.parse(init.body as string)).toEqual({ estado_objetivo: 'entregado', version_esperada: 3, qr_token: 'abc' });
    expect(new Headers(init.headers).get('Idempotency-Key')).toBeTruthy();
  });
});

describe('createBuyerCallClient', () => {
  it('avisa que la función no está disponible si el backend responde 404', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(notFound())));
    await expect(createBuyerCallClient('tok').call(4, 'utensilios', 'p1')).rejects.toBeInstanceOf(CallsUnavailableError);
  });
});
