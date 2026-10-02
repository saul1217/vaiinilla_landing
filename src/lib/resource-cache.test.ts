import { afterEach, describe, expect, it, vi } from 'vitest';
import { cachedResource, clearResourceCache, peekResource, storeResource } from './resource-cache';

afterEach(() => {
  clearResourceCache();
  vi.useRealTimers();
});

describe('memoria de datos del dock', () => {
  it('reutiliza un dato fresco sin volver a pedirlo', async () => {
    const load = vi.fn().mockResolvedValue('menú');
    await cachedResource('k', 60_000, load);
    await expect(cachedResource('k', 60_000, load)).resolves.toBe('menú');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('comparte una petición en curso entre quienes la piden a la vez', async () => {
    let resolve!: (value: string) => void;
    const load = vi.fn(() => new Promise<string>((r) => { resolve = r; }));
    const a = cachedResource('k', 60_000, load);
    const b = cachedResource('k', 60_000, load);
    resolve('ok');
    await expect(Promise.all([a, b])).resolves.toEqual(['ok', 'ok']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('vuelve a pedir cuando el dato ya es viejo', async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2');
    await cachedResource('k', 1_000, load);
    vi.advanceTimersByTime(1_001);
    await expect(cachedResource('k', 1_000, load)).resolves.toBe('v2');
  });

  it('no guarda un error: el siguiente intento vuelve a pedir', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('sin red')).mockResolvedValueOnce('ok');
    await expect(cachedResource('k', 60_000, load)).rejects.toThrow('sin red');
    await expect(cachedResource('k', 60_000, load)).resolves.toBe('ok');
  });

  it('peek devuelve lo guardado y clear lo borra todo', () => {
    storeResource('pedidos', [1, 2]);
    expect(peekResource('pedidos')).toEqual([1, 2]);
    clearResourceCache();
    expect(peekResource('pedidos')).toBeUndefined();
  });
});
