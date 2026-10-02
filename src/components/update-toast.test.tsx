import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateToast } from './update-toast';

function fakeServiceWorker() {
  const postMessage = vi.fn();
  const waiting = { postMessage } as unknown as ServiceWorker;
  const registration = {
    waiting,
    update: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      controller: {},
      getRegistration: vi.fn().mockResolvedValue(registration),
      addEventListener: vi.fn(),
    },
  });
  return postMessage;
}

function setVisibility(state: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
}

function serveUpdateJson(importante: boolean) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ importante }) }));
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('UpdateToast', () => {
  beforeEach(() => setVisibility('visible'));
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('una versión normal no muestra aviso y se aplica en silencio al ocultar la pestaña', async () => {
    const waiting = fakeServiceWorker();
    serveUpdateJson(false);
    render(<UpdateToast />);
    await flush();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(waiting).not.toHaveBeenCalled();

    act(() => setVisibility('hidden'));
    expect(waiting).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('una versión importante muestra el aviso y no se aplica sola', async () => {
    const waiting = fakeServiceWorker();
    serveUpdateJson(true);
    render(<UpdateToast />);
    await flush();

    expect(screen.getByRole('status')).toHaveTextContent('Hay una versión nueva importante');
    act(() => setVisibility('hidden'));
    expect(waiting).not.toHaveBeenCalled();
  });

  it('si no se puede leer update.json, la trata como normal', async () => {
    const waiting = fakeServiceWorker();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(<UpdateToast />);
    await flush();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    act(() => setVisibility('hidden'));
    expect(waiting).toHaveBeenCalled();
  });
});
