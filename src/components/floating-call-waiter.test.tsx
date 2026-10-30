import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VaiinillaApiError } from '../lib/api-error';
import { clampY, fabBounds, readFabPosition, snapSide } from '../lib/floating-call';
import type { BuyerCallClient, TableCall } from '../lib/mesero-api';
import { forgetSpace, rememberSpace } from '../lib/space-session';
import { FloatingCallWaiter } from './floating-call-waiter';
import { PedidoChargeOverlay } from './pedido-charge-overlay';

const MESA = { id: 4, nombre: 'Mesa 4', tipo: 'mesa' };

function tableCall(): TableCall {
  return {
    id: 'c1',
    espacio: MESA,
    pedido_id: null,
    motivo: 'atencion',
    estado: 'pendiente',
    cliente: null,
    tomada_por: null,
    creado_en: '2026-09-29T18:00:00Z',
    tomada_en: null,
    cerrada_en: null,
    version: 1,
  };
}

function client(overrides: Partial<BuyerCallClient> = {}): BuyerCallClient {
  return {
    current: vi.fn(() => Promise.resolve(null)),
    call: vi.fn(() => Promise.resolve(tableCall())),
    cancel: vi.fn(() => Promise.resolve({ ...tableCall(), estado: 'cancelada' as const })),
    ...overrides,
  };
}

async function mount(path = '/e/demo', api: BuyerCallClient = client()) {
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <FloatingCallWaiter client={api} />
    </MemoryRouter>,
  );
  await act(async () => {});
  return view;
}

const fab = () => screen.getByRole('button', { name: /llamar al mesero/i });
const pos = (x: number, y: number) => ({ pointerId: 1, clientX: x, clientY: y, button: 0 });

function drag(from: [number, number], to: [number, number]) {
  const button = fab();
  fireEvent.pointerDown(button, pos(...from));
  fireEvent.pointerMove(button, pos(...to));
  fireEvent.pointerUp(button, pos(...to));
}

describe('helpers de posición', () => {
  it('se pega a la orilla cuyo lado contiene el centro', () => {
    expect(snapSide(100, 56, 400)).toBe('left');
    expect(snapSide(250, 56, 400)).toBe('right');
    expect(snapSide(120, 200, 400)).toBe('right');
    expect(snapSide(120, 56, 400)).toBe('left');
  });

  it('deja el botón arriba de la barra inferior y, en el Carrito, del botón de pagar', () => {
    const home = fabBounds(800, { desktop: false, cart: false });
    const cart = fabBounds(800, { desktop: false, cart: true });
    expect(clampY(5000, home)).toBe(800 - 84 - 56);
    expect(clampY(5000, cart)).toBe(800 - 216 - 56);
    expect(clampY(-50, home)).toBe(home.top);
  });
});

describe('FloatingCallWaiter', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0, writable: true });
    localStorage.clear();
    sessionStorage.clear();
    window.innerWidth = 400;
    window.innerHeight = 800;
    rememberSpace({ slug: 'demo', espacioId: 4, nombre: 'Mesa 4', tipo: 'mesa' });
  });

  it.each(['/e/demo', '/cuenta/pedidos', '/cuenta/saldo', '/e/demo/carrito'])('aparece en %s con una mesa escaneada', async (path) => {
    await mount(path);
    expect(fab()).toBeTruthy();
  });

  it('muestra el pill arriba y lo colapsa al bajar, expandiéndolo al volver', async () => {
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 1600 });
    await mount();
    expect(screen.getByText('Llamar al mesero').className).toContain('alumno-fcw__label--full');
    expect(screen.getByText('Mesero').getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByTestId('floating-call').className).not.toContain('is-collapsed');
    window.scrollY = 9;
    fireEvent.scroll(window);
    expect(screen.getByTestId('floating-call').className).toContain('is-collapsed');
    expect(fab()).toBeTruthy();
    window.scrollY = 0;
    fireEvent.scroll(window);
    expect(screen.getByTestId('floating-call').className).not.toContain('is-collapsed');
    expect(screen.getByTestId('floating-call').style.right).toContain('12px');
  });

  it.each(['/e/demo/carrito', '/e/demo/carrito/'])('permanece colapsada en %s incluso arriba', async (path) => {
    await mount(path);
    expect(screen.getByTestId('floating-call').className).toContain('is-collapsed');
    window.scrollY = 300;
    fireEvent.scroll(window);
    window.scrollY = 0;
    fireEvent.scroll(window);
    expect(screen.getByTestId('floating-call').className).toContain('is-collapsed');
  });

  it.each([undefined, 'qr-demo'])('ofrece unirse a la mesa en un 403, con QR %s', async (qrToken) => {
    rememberSpace({ slug: 'demo', espacioId: 4, nombre: 'Mesa 4', qrToken });
    await mount('/e/demo', client({ call: vi.fn().mockRejectedValue(
      new VaiinillaApiError(403, { code: 'NO_ACTIVE_ORDER_IN_SPACE', message: 'Denied' }),
    ) }));
    fireEvent.click(fab());
    fireEvent.click(screen.getByRole('button', { name: 'Necesito algo' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Para llamar al mesero, primero únete a la mesa.');
    if (qrToken) expect(screen.getByRole('link').getAttribute('href')).toBe('/demo/m/qr-demo/quien');
    else expect(screen.queryByRole('link')).toBeNull();
  });

  it('anuncia los errores generales como alertas', async () => {
    await mount('/e/demo', client({ call: vi.fn().mockRejectedValue(new Error('Sin conexión')) }));
    fireEvent.click(fab());
    fireEvent.click(screen.getByRole('button', { name: 'Necesito algo' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Sin conexión');
  });

  it.each([undefined, 7])('usa cooldown de 15 segundos o Retry-After %s', async (retryAfter) => {
    vi.useFakeTimers();
    try {
      await mount('/e/demo', client({ call: vi.fn().mockRejectedValue(
        new VaiinillaApiError(429, { code: 'RATE_LIMITED', message: 'Espera' }, retryAfter),
      ) }));
      fireEvent.click(fab());
      fireEvent.click(screen.getByRole('button', { name: 'Necesito algo' }));
      await act(async () => {});
      const seconds = retryAfter ?? 15;
      expect(fab().getAttribute('aria-label')).toContain(seconds + ' segundos');
      for (let i = 0; i < seconds; i++) await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
      expect(fab().getAttribute('aria-label')).toBe('Llamar al mesero');
    } finally {
      vi.useRealTimers();
    }
  });

  it('no aparece sin mesa escaneada', async () => {
    forgetSpace();
    await mount();
    expect(screen.queryByRole('button', { name: /llamar al mesero/i })).toBeNull();
  });

  it('se oculta mientras hay una pantalla de pago', async () => {
    render(
      <MemoryRouter initialEntries={['/cuenta/pedidos/1']}>
        <FloatingCallWaiter client={client()} />
        <PedidoChargeOverlay phase="processing" />
      </MemoryRouter>,
    );
    await act(async () => {});
    expect(screen.queryByTestId('floating-call')).toBeNull();
  });

  it('un toque corto abre "¿Qué necesitas?" y cada opción llama a la mesa', async () => {
    const callSpy = vi.fn(() => Promise.resolve(tableCall()));
    await mount('/e/demo', client({ call: callSpy }));
    fireEvent.pointerDown(fab(), pos(200, 300));
    fireEvent.pointerUp(fab(), pos(203, 302));
    fireEvent.click(fab());
    expect(screen.getByText('¿Qué necesitas?')).toBeTruthy();
    const dialog = screen.getByRole('dialog', { name: '¿Qué necesitas?' });
    expect(dialog.getAttribute('aria-labelledby')).toBe(screen.getByText('¿Qué necesitas?').id);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Necesito algo' }));
    expect(screen.queryByRole('button', { name: 'Pedir la cuenta' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Cubiertos o servilletas' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Algo está mal con mi pedido' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Necesito algo' }));
    await screen.findByText('Llamando a tu mesero…');
    expect(callSpy).toHaveBeenCalledWith(4, 'atencion', null);
  });

  it('Pedir la cuenta solo aparece si se paga al final', async () => {
    rememberSpace({ slug: 'demo', espacioId: 4, nombre: 'Mesa 4', pagaAlFinal: true });
    await mount();
    fireEvent.click(fab());
    expect(screen.getByRole('button', { name: 'Pedir la cuenta' })).toBeTruthy();
  });

  it('el teclado abre el menú y Escape lo cierra', async () => {
    await mount();
    fab().focus();
    fireEvent.click(fab());
    expect(fab().getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(fab().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(fab());
  });

  it('arrastrar no abre el menú y se pega a la orilla izquierda', async () => {
    await mount();
    drag([350, 300], [60, 320]);
    fireEvent.click(fab());
    expect(screen.queryByText('¿Qué necesitas?')).toBeNull();
    expect(screen.getByTestId('floating-call').className).toContain('is-left');
    expect(readFabPosition()?.side).toBe('left');
  });

  it('usa el ancho real para limitar el arrastre y elegir la orilla', async () => {
    await mount();
    Object.defineProperty(fab(), 'offsetWidth', { configurable: true, value: 200 });
    fireEvent.pointerDown(fab(), pos(0, 0));
    fireEvent.pointerMove(fab(), pos(500, 20));
    expect(screen.getByTestId('floating-call').style.left).toBe('200px');
    fireEvent.pointerUp(fab(), pos(120, 20));
    expect(readFabPosition()?.side).toBe('right');
    fireEvent.keyDown(fab(), { key: 'ArrowLeft' });
    expect(readFabPosition()?.side).toBe('left');
    fireEvent.keyDown(fab(), { key: 'ArrowRight' });
    expect(readFabPosition()?.side).toBe('right');
  });

  it('pegada a la izquierda respeta la barra lateral en pantalla ancha', async () => {
    await mount();
    drag([350, 300], [60, 320]);
    const left = screen.getByTestId('floating-call').style.left;
    expect(left).toContain('var(--fcw-inset-left, 0px)');
  });

  it('la posición se guarda y se restaura al recargar', async () => {
    const first = await mount();
    drag([350, 300], [60, 320]);
    const saved = readFabPosition();
    expect(saved).toEqual({ side: 'left', y: 20 });
    first.unmount();
    await mount('/cuenta/pedidos');
    expect(screen.getByTestId('floating-call').className).toContain('is-left');
    expect(screen.getByTestId('floating-call').style.getPropertyValue('--fcw-y')).toBe('20px');
  });

  it('arrastrar hacia abajo fuera de la pantalla lo deja arriba de la barra inferior', async () => {
    await mount();
    drag([350, 300], [350, 5000]);
    expect(readFabPosition()?.y).toBe(800 - 84 - 56);
  });

  it('aparece de inmediato con la mesa guardada, sin esperar la sesión del backend', () => {
    render(
      <MemoryRouter initialEntries={['/e/demo']}>
        <FloatingCallWaiter />
      </MemoryRouter>,
    );
    expect(sessionStorage.length).toBe(0);
    expect(fab()).toBeTruthy();
  });
});

 describe('finalización y envío único', () => {
  it.each(['atendida', 'expirada', 'cancelada', null, 'error'] as const)('estado final %s', async (estado) => {
    vi.useFakeTimers();
    try {
      rememberSpace({ slug: 'demo', espacioId: 4, nombre: 'Mesa 4' });
      const api = client({
        current: vi.fn().mockResolvedValueOnce(tableCall()).mockResolvedValue(null),
        finalState: estado === 'error' ? vi.fn().mockRejectedValue(new Error('Sin conexión')) : vi.fn().mockResolvedValue(estado),
      });
      await mount('/e/demo', api);
      await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
      if (estado === 'atendida') {
        expect(fab().getAttribute('aria-label')).toContain('15 segundos');
        for (let i = 0; i < 15; i++) await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
        expect(fab().getAttribute('aria-label')).toBe('Llamar al mesero');
      }
      else { expect(fab().getAttribute('aria-label')).toBe('Llamar al mesero'); }
    } finally { vi.useRealTimers(); }
  });
  it('dos clicks rápidos envían una sola llamada', async () => {
    rememberSpace({ slug: 'demo', espacioId: 4, nombre: 'Mesa 4' });
    const send = vi.fn(() => new Promise<TableCall>(() => {}));
    const api = client({ call: send });
    await mount('/e/demo', api);
    fireEvent.click(screen.getByRole('button', { name: 'Llamar al mesero' }));
    const option = screen.getByRole('button', { name: 'Necesito algo' });
    act(() => {
      fireEvent.click(option);
      fireEvent.click(option);
    });
    expect(send).toHaveBeenCalledTimes(1);
  });
});

 describe('sin scroll y foco', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 0 });
    rememberSpace({ slug: 'demo', espacioId: 4, nombre: 'Mesa 4' });
    window.scrollY = 0;
  });
  it.each(['timer', 'pointerdown', 'keydown', 'scroll'])('colapsa por %s y permanece colapsada', async (event) => {
    vi.useFakeTimers();
    try {
      await mount();
      if (event === 'timer') await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
      else fireEvent(document, new Event(event, { bubbles: true }));
      fireEvent.scroll(window);
      expect(screen.getByTestId('floating-call').className).toContain('is-collapsed');
    } finally { vi.useRealTimers(); }
  });
  it('en cooldown enfoca el texto; Escape devuelve foco, sin modal', async () => {
    await mount('/e/demo', client({ call: vi.fn().mockRejectedValue(new VaiinillaApiError(429, { code: 'RATE_LIMITED', message: 'Espera' }, 7)) }));
    fireEvent.click(fab());
    fireEvent.click(screen.getByRole('button', { name: 'Necesito algo' }));
    await act(async () => {});
    fireEvent.click(fab());
    expect(document.activeElement).toBe(screen.getByText('Puedes volver a llamar en 7 s'));
    expect(screen.getByRole('dialog').hasAttribute('aria-modal')).toBe(false);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(fab());
  });
});
