import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    expect(snapSide(100, 400)).toBe('left');
    expect(snapSide(250, 400)).toBe('right');
  });

  it('deja el botón arriba de la barra inferior y, en el Carrito, del botón de pagar', () => {
    const home = fabBounds(800, { desktop: false, cart: false });
    const cart = fabBounds(800, { desktop: false, cart: true });
    expect(clampY(5000, home)).toBe(800 - 84 - 56);
    expect(clampY(5000, cart)).toBe(800 - 160 - 56);
    expect(clampY(-50, home)).toBe(home.top);
  });
});

describe('FloatingCallWaiter', () => {
  beforeEach(() => {
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
    expect(screen.getByRole('button', { name: 'Necesito algo' })).toBeTruthy();
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
    expect(screen.getByRole('button', { name: 'Pedir cuenta' })).toBeTruthy();
  });

  it('el teclado abre el menú y Escape lo cierra', async () => {
    await mount();
    fab().focus();
    fireEvent.click(fab());
    expect(fab().getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(fab().getAttribute('aria-expanded')).toBe('false');
  });

  it('arrastrar no abre el menú y se pega a la orilla izquierda', async () => {
    await mount();
    drag([350, 300], [60, 320]);
    fireEvent.click(fab());
    expect(screen.queryByText('¿Qué necesitas?')).toBeNull();
    expect(screen.getByTestId('floating-call').className).toContain('is-left');
    expect(readFabPosition()?.side).toBe('left');
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
});
