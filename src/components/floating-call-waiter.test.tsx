import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    expect(fab()).toHaveTextContent('Llamar al mesero');
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
    fireEvent.pointerDown(fab(), { pointerId: 1, clientX: 200, clientY: 300, button: 0 });
    fireEvent.pointerUp(fab(), { pointerId: 1, clientX: 203, clientY: 302, button: 0 });
    fireEvent.click(fab());
    expect(screen.getByText('¿Qué necesitas?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Necesito algo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cubiertos o servilletas' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Algo está mal con mi pedido' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Necesito algo' }));
    await screen.findByText('Llamando a tu mesero…');
    expect(callSpy).toHaveBeenCalledWith(4, 'atencion', null);
  });

  it('un toque con movimiento abre el panel', async () => {
    await mount();
    fireEvent.pointerDown(fab(), { pointerId: 1, clientX: 200, clientY: 300, button: 0 });
    fireEvent.pointerMove(fab(), { pointerId: 1, clientX: 260, clientY: 360, button: 0 });
    fireEvent.pointerUp(fab(), { pointerId: 1, clientX: 260, clientY: 360, button: 0 });
    fireEvent.click(fab());
    expect(screen.getByText('¿Qué necesitas?')).toBeInTheDocument();
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

  it('no registra una posición del control', async () => {
    await mount();
    expect(localStorage.getItem('vaiinilla.buyer.call-fab.v1')).toBeNull();
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
