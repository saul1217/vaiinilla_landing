import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LIVE_SAFETY_MS,
  parseSseBlocks,
  resetLiveStreamsForTests,
  useLiveSignal,
  type LiveEvent,
  type LiveStreamRef,
} from './live-events';

const flag = globalThis as { __LIVE_EVENTS_TEST__?: boolean };

/** Respuesta SSE controlable: `push` manda texto y `end` cierra. */
function sseResponse() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  const encoder = new TextEncoder();
  return {
    response: new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    push: (text: string) => controller.enqueue(encoder.encode(text)),
    end: () => controller.close(),
  };
}

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

describe('parseSseBlocks', () => {
  it('separa eventos completos, ignora comentarios y deja lo incompleto', () => {
    const { events, rest } = parseSseBlocks(
      'retry: 5000\n\nevent: listo\ndata: {}\n\n: ping\n\nevent: pedido\ndata: {"id":"p1","v":2}\n\nevent: lla',
    );
    expect(events).toEqual([
      { event: 'listo', data: '{}' },
      { event: 'pedido', data: '{"id":"p1","v":2}' },
    ]);
    expect(rest).toBe('event: lla');
  });

  it('acepta saltos de línea \\r\\n', () => {
    expect(parseSseBlocks('event: mesa\r\ndata: {"espacio_id":3}\r\n\r\n').events).toEqual([
      { event: 'mesa', data: '{"espacio_id":3}' },
    ]);
  });
});

describe('useLiveSignal', () => {
  beforeEach(() => {
    flag.__LIVE_EVENTS_TEST__ = true;
    vi.stubEnv('VITE_API_URL', 'https://api.test/api/v1');
  });
  afterEach(() => {
    resetLiveStreamsForTests();
    delete flag.__LIVE_EVENTS_TEST__;
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('abre un canal con el token, avisa los eventos que coinciden y marca en vivo', async () => {
    const sse = sseResponse();
    const fetchMock = vi.fn(() => Promise.resolve(sse.response));
    vi.stubGlobal('fetch', fetchMock);
    const onSignal = vi.fn();
    const refs: LiveStreamRef[] = [{ kind: 'cliente', token: 'tok' }];

    const { result } = renderHook(() =>
      useLiveSignal(refs, (e: LiveEvent) => e.type === 'pedido' && e.data.id === 'p1', onSignal),
    );
    await flush();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.test/api/v1/eventos');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok');
    expect(result.current).toBe(false);

    sse.push('retry: 5000\n\nevent: listo\ndata: {}\n\n');
    await flush();
    expect(result.current).toBe(true);

    sse.push('event: pedido\ndata: {"id":"p2","v":1}\n\nevent: pedido\ndata: {"id":"p1","v":3}\n\n');
    await flush();
    expect(onSignal).toHaveBeenCalledTimes(1);
    expect(onSignal).toHaveBeenCalledWith({ type: 'pedido', data: { id: 'p1', v: 3 } });
  });

  it('dos pantallas con el mismo token comparten un solo canal', async () => {
    const sse = sseResponse();
    const fetchMock = vi.fn(() => Promise.resolve(sse.response));
    vi.stubGlobal('fetch', fetchMock);
    const refs: LiveStreamRef[] = [{ kind: 'cliente', token: 'tok' }];
    renderHook(() => useLiveSignal(refs, () => true, () => undefined));
    renderHook(() => useLiveSignal(refs, () => true, () => undefined));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('el seguimiento de invitado usa su ruta pública sin header de token', async () => {
    const sse = sseResponse();
    const fetchMock = vi.fn(() => Promise.resolve(sse.response));
    vi.stubGlobal('fetch', fetchMock);
    renderHook(() => useLiveSignal([{ kind: 'seguimiento', token: 'abc' }], () => true, () => undefined));
    await flush();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.test/api/v1/publico/seguimiento/abc/eventos');
    expect(new Headers(init.headers).get('Authorization')).toBeNull();
  });

  it('sin tiempo real en el back (404) no queda en vivo: la pantalla sigue preguntando', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{}', { status: 404 }))),
    );
    const { result } = renderHook(() =>
      useLiveSignal([{ kind: 'cliente', token: 'tok' }], () => true, () => undefined),
    );
    await flush();
    expect(result.current).toBe(false);
  });

  it('al reconectar tras un corte pide releer (resync) y vuelve a quedar en vivo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const primera = sseResponse();
    const segunda = sseResponse();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(primera.response)
      .mockResolvedValueOnce(segunda.response);
    vi.stubGlobal('fetch', fetchMock);
    const onSignal = vi.fn();
    const { result } = renderHook(() =>
      useLiveSignal([{ kind: 'cliente', token: 'tok' }], () => false, onSignal),
    );
    await flush();
    primera.push('event: listo\ndata: {}\n\n');
    await flush();
    expect(result.current).toBe(true);

    primera.push('event: reconectar\ndata: {"motivo":"tiempo"}\n\n');
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    segunda.push('event: listo\ndata: {}\n\n');
    await flush();
    expect(result.current).toBe(true);
    expect(onSignal).toHaveBeenCalledWith({ type: 'resync', data: {} });
    vi.useRealTimers();
  });

  it('la relectura de seguridad con el canal abierto es de un minuto', () => {
    expect(LIVE_SAFETY_MS).toBe(60_000);
  });
});
