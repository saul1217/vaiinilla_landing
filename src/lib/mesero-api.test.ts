import { afterEach, describe, expect, it, vi } from 'vitest';
import { CallsUnavailableError, createBuyerCallClient } from './mesero-api';

const notFound = () => new Response(JSON.stringify({ data: null, meta: {}, error: { code: 'NOT_FOUND', message: 'No existe' } }), { status: 404 });

afterEach(() => vi.unstubAllGlobals());

describe('createBuyerCallClient', () => {
  it('avisa que la función no está disponible si el backend responde 404', async () => {
     vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(notFound())));
     await expect(createBuyerCallClient('tok').call(4, 'utensilios', 'p1')).rejects.toBeInstanceOf(CallsUnavailableError);
  });

  it.each(['atendida', 'expirada', 'cancelada', null])('consulta el estado final por ID: %s', async (estado) => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 'otra', estado: 'atendida' }, ...(estado ? [{ id: 'c1', estado }] : [])], meta: {}, error: null }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    expect(await createBuyerCallClient('tok').finalState!('c1')).toBe(estado);
    expect(String(fetch.mock.calls[0]![0])).toContain('/llamadas?estado=atendida,cancelada,expirada');
  });
});
