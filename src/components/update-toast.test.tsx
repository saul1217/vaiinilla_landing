import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PWA_UPDATE_IDLE_MS } from '../lib/pwa-update';
import * as pwaUpdate from '../lib/pwa-update';
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
  return { postMessage, registration };
}

function setVisibility(state: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
}

function serveUpdateJson(importante: boolean) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ importante }) }));
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderToast(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <UpdateToast />
    </MemoryRouter>,
  );
}

describe('UpdateToast', () => {
  beforeEach(() => {
    setVisibility('visible');
    vi.spyOn(pwaUpdate, 'canSilentlyApplyServiceWorkerUpdate').mockReturnValue(true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('una versión normal no muestra aviso y se aplica en silencio al ocultar la pestaña', async () => {
    const { postMessage: waiting } = fakeServiceWorker();
    serveUpdateJson(false);
    renderToast();
    await flushMicrotasks();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(waiting).not.toHaveBeenCalled();

    act(() => setVisibility('hidden'));
    expect(waiting).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('una versión importante muestra el aviso y también se aplica sola al ocultar la pestaña', async () => {
    const { postMessage: waiting } = fakeServiceWorker();
    serveUpdateJson(true);
    renderToast();
    await flushMicrotasks();

    expect(screen.getByRole('status')).toHaveTextContent('Hay una versión nueva importante');
    expect(waiting).not.toHaveBeenCalled();

    act(() => setVisibility('hidden'));
    expect(waiting).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('importante: el botón Actualizar activa el SW aunque la pestaña siga visible', async () => {
    const { postMessage: waiting } = fakeServiceWorker();
    serveUpdateJson(true);
    const user = userEvent.setup();
    renderToast();
    await flushMicrotasks();

    await user.click(screen.getByRole('button', { name: /actualizar/i }));
    expect(waiting).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('no aplica al ocultar si el checkout no es seguro', async () => {
    vi.mocked(pwaUpdate.canSilentlyApplyServiceWorkerUpdate).mockReturnValue(false);
    const { postMessage: waiting } = fakeServiceWorker();
    serveUpdateJson(false);
    renderToast();
    await flushMicrotasks();

    act(() => setVisibility('hidden'));
    expect(waiting).not.toHaveBeenCalled();
  });

  it('si no se puede leer update.json, la trata como normal', async () => {
    const { postMessage: waiting } = fakeServiceWorker();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    renderToast();
    await flushMicrotasks();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    act(() => setVisibility('hidden'));
    expect(waiting).toHaveBeenCalled();
  });
});

describe('UpdateToast respaldos', () => {
  beforeEach(() => {
    setVisibility('visible');
    vi.spyOn(pwaUpdate, 'canSilentlyApplyServiceWorkerUpdate').mockReturnValue(true);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('P4: aplica tras inactividad con carrito vacío', async () => {
    vi.useFakeTimers();
    const { postMessage: waiting } = fakeServiceWorker();
    serveUpdateJson(false);
    renderToast();
    await flushMicrotasks();

    expect(waiting).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(PWA_UPDATE_IDLE_MS);
    });
    expect(waiting).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('P5: aplica al volver al inicio de /pedir', async () => {
    const { postMessage: waiting } = fakeServiceWorker();
    serveUpdateJson(false);
    renderToast('/pedir');
    await flushMicrotasks();

    expect(waiting).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });
});
