import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VaiinillaApiError } from '../lib/api-error';
import { CallsUnavailableError, canCallWaiter, type BuyerCallClient, type TableCall } from '../lib/mesero-api';
import type { OrderDetail } from '../types/api';
import { CallWaiter } from './call-waiter';

vi.mock('../context/buyer-session', () => ({
  useBuyerSessionToken: () => 'tok',
}));

const MESA = { id: 4, nombre: 'Mesa 4', tipo: 'mesa' };

function order(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    id: 'p1',
    folio: 96,
    estado: 'preparando',
    destino: 'en_espacio',
    espacio: MESA,
    ...overrides,
  } as OrderDetail;
}

function call(overrides: Partial<TableCall> = {}): TableCall {
  return {
    id: 'c1',
    espacio: MESA,
    pedido_id: 'p1',
    motivo: 'utensilios',
    estado: 'pendiente',
    cliente: { nombre: 'Ana' },
    tomada_por: null,
    creado_en: '2026-09-29T18:00:00Z',
    tomada_en: null,
    cerrada_en: null,
    version: 1,
    ...overrides,
  };
}

function client(overrides: Partial<BuyerCallClient> = {}): BuyerCallClient {
  return {
    current: vi.fn(() => Promise.resolve(null)),
    call: vi.fn(() => Promise.resolve(call())),
    cancel: vi.fn(() => Promise.resolve(call({ estado: 'cancelada' }))),
    ...overrides,
  };
}

describe('CallWaiter', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.useRealTimers());

  it('un pedido para llevar o ya cerrado no consulta llamadas al backend', async () => {
    const current = vi.fn(() => Promise.resolve(null));
    const api = client({ current });
    render(<CallWaiter order={order({ destino: 'para_llevar', espacio: null })} client={api} />);
    render(<CallWaiter order={order({ estado: 'expirado' })} client={api} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(current).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /llamar al mesero/i })).not.toBeInTheDocument();
  });

  it('solo aparece en pedidos para mesa que siguen abiertos', () => {
    expect(canCallWaiter(order())).toBe(true);
    expect(canCallWaiter(order({ destino: 'para_llevar', espacio: null }))).toBe(false);
    expect(canCallWaiter(order({ estado: 'cancelado' }))).toBe(false);
    expect(canCallWaiter(order({ estado: 'expirado' }))).toBe(false);
  });

  it('llama con el motivo elegido y muestra que está llamando', async () => {
    const user = userEvent.setup();
    const callFn = vi.fn(() => Promise.resolve(call()));
    render(<CallWaiter order={order()} client={client({ call: callFn })} />);

    await user.click(await screen.findByRole('button', { name: /Llamar al mesero/ }));
    await user.click(screen.getByRole('button', { name: 'Cubiertos o servilletas' }));

    expect(callFn).toHaveBeenCalledWith(4, 'utensilios', 'p1');
    expect(await screen.findByText('Llamando a tu mesero…')).toBeInTheDocument();
  });

  it('muestra al mesero en camino al recuperar la llamada', async () => {
    const fake = client({
      current: vi.fn(() =>
        Promise.resolve(call({ estado: 'en_camino', tomada_por: { usuario_id: 'm1', nombre: 'Luis' } })),
      ),
    });
    render(<CallWaiter order={order()} client={fake} />);

    expect(await screen.findByText('Luis va en camino')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
  });

  it('respeta el Retry-After del backend cuando responde 429', async () => {
    const user = userEvent.setup();
    const fake = client({
      call: vi.fn(() =>
        Promise.reject(new VaiinillaApiError(429, { code: 'RATE_LIMITED', message: 'Espera' }, 42)),
      ),
    });
    render(<CallWaiter order={order()} client={fake} />);

    await user.click(await screen.findByRole('button', { name: /Llamar al mesero/ }));
    await user.click(screen.getByRole('button', { name: 'Necesito algo' }));

    const cta = await screen.findByRole('button', { name: /Puedes volver a llamar en 42 s/ });
    expect(cta).toBeDisabled();
  });

  it('avisa si el establecimiento no tiene llamadas activas', async () => {
    const fake = client({
      current: vi.fn(() => Promise.reject(new CallsUnavailableError('no'))),
    });
    render(<CallWaiter order={order()} client={fake} />);

    await waitFor(() =>
      expect(
        screen.getByText('Llamar al mesero todavía no está disponible en esta cafetería.'),
      ).toBeInTheDocument(),
    );
  });

  it('consulta de nuevo cada 5 segundos', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const current = vi.fn(() => Promise.resolve(null));
    render(<CallWaiter order={order()} client={client({ current })} />);
    await waitFor(() => expect(current).toHaveBeenCalledTimes(1));
    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });
    expect(current).toHaveBeenCalledTimes(2);
  });
});

describe('CallWaiter: pedir la cuenta', () => {
  it('"Pedir cuenta" solo sale en un pedido a la cuenta', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<CallWaiter order={order()} client={client()} />);
    await user.click(await screen.findByRole('button', { name: /llamar al mesero/i }));
    expect(screen.queryByRole('button', { name: /pagar la cuenta/i })).not.toBeInTheDocument();
    unmount();

    const send = vi.fn(() => Promise.resolve(call({ motivo: 'cuenta' })));
    render(
      <CallWaiter order={order({ pago_diferido: true, pago_pendiente: true })} client={client({ call: send })} />,
    );
    await user.click(await screen.findByRole('button', { name: /llamar al mesero/i }));
    await user.click(screen.getByRole('button', { name: 'Pedir cuenta' }));
    expect(send).toHaveBeenCalledWith(4, 'cuenta', 'p1');
  });
});
