import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SharedTable } from '../types/api';
import { SharedTableCard } from './shared-table-card';
import { orderedGroups, tableOrderState } from '../lib/shared-table';

const apiMock = vi.hoisted(() => ({ currentTable: vi.fn(), joinTable: vi.fn(), leaveTable: vi.fn(), claimTableOrder: vi.fn() }));
vi.mock('../lib/api', () => ({ api: apiMock }));

const ZERO = { total: '0.00', pagado: '0.00', pendiente: '0.00' };

function table(overrides: Partial<SharedTable> = {}): SharedTable {
  return {
    espacio: { id: 3, nombre: 'Mesa 3', tipo: 'mesa' },
    mi_alias: 'Ana',
    cuenta_abierta: true,
    participantes: [
      { alias: 'Luis', soy_yo: false, unido_en: null },
      { alias: 'Ana', soy_yo: true, unido_en: null },
    ],
    grupos: [
      {
        alias: 'Luis',
        soy_yo: false,
        total: '20.20',
        pagado: '20.20',
        pendiente: '0.00',
        pedidos: [{ id: null, folio: 7, estado: 'listo', items_resumen: '1× Torta', total: '20.20', pendiente_cobro: false, creado_en: 'a' }],
      },
      {
        alias: 'Ana',
        soy_yo: true,
        total: '10.10',
        pagado: '0.00',
        pendiente: '10.10',
        pedidos: [{ id: 'p1', folio: 8, estado: 'preparando', items_resumen: '1× Taco', total: '10.10', pendiente_cobro: true, creado_en: 'b' }],
      },
    ],
    totales: { total: '30.30', pagado: '20.20', pendiente: '10.10' },
    mi_parte: { total: '10.10', pagado: '0.00', pendiente: '10.10' },
    ...overrides,
  };
}

describe('mesa compartida', () => {
  beforeEach(() => {
    apiMock.currentTable.mockReset();
    apiMock.joinTable.mockReset();
    apiMock.leaveTable.mockReset();
  });

  it('a la cuenta y sin pagar no dice "Cobrado"', () => {
    const base = { id: null, folio: 1, items_resumen: '', total: '1.00', creado_en: null };
    expect(tableOrderState({ ...base, estado: 'cobrado', pendiente_cobro: true })).toBe('En la cuenta');
    expect(tableOrderState({ ...base, estado: 'listo', pendiente_cobro: true })).toBe('Listo');
    expect(tableOrderState({ ...base, estado: 'entregado', pendiente_cobro: false })).toBe('Entregado · pagado');
  });

  it('tus pedidos van primero', () => {
    expect(orderedGroups(table()).map((g) => g.alias)).toEqual(['Ana', 'Luis']);
  });

  it('sin mesa, quien llegó por el QR se une con un alias', async () => {
    apiMock.currentTable.mockResolvedValue(null);
    apiMock.joinTable.mockResolvedValue(table());
    const user = userEvent.setup();
    render(<SharedTableCard accessToken="jwt" qrToken="qr-1" />);

    await user.type(await screen.findByRole('textbox', { name: /tu nombre en la mesa/i }), '  Ana ');
    await user.click(screen.getByRole('button', { name: /unirme a la mesa/i }));

    expect(apiMock.joinTable).toHaveBeenCalledWith('jwt', 'qr-1', 'Ana');
    expect(await screen.findByRole('article', { name: 'Mesa 3' })).toBeInTheDocument();
  });

  it('sin QR y sin mesa no muestra nada', async () => {
    apiMock.currentTable.mockResolvedValue(null);
    const { container } = render(<SharedTableCard accessToken="jwt" qrToken={null} />);
    await waitFor(() => expect(apiMock.currentTable).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('muestra quién está, los pedidos por persona y tu parte', async () => {
    apiMock.currentTable.mockResolvedValue(table());
    render(<SharedTableCard accessToken="jwt" qrToken={null} />);

    expect(await screen.findByText('2 personas')).toBeInTheDocument();
    expect(screen.getByText('Ana (tú)')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /tus pedidos/i })).toBeInTheDocument();
    expect(screen.getByText('1× Torta')).toBeInTheDocument();
    expect(screen.getByText(/listo · pagado/i)).toBeInTheDocument();
    expect(screen.getByText('Tu parte por pagar').nextElementSibling).toHaveTextContent('$10.10');
  });

  it('sin pedidos en la cuenta lo dice', async () => {
    apiMock.currentTable.mockResolvedValue(table({ cuenta_abierta: false, grupos: [], totales: ZERO, mi_parte: ZERO }));
    render(<SharedTableCard accessToken="jwt" qrToken={null} />);
    expect(await screen.findByText(/aún no hay pedidos en la cuenta de la mesa/i)).toBeInTheDocument();
  });

  it('salir de la mesa', async () => {
    apiMock.currentTable.mockResolvedValue(table());
    apiMock.leaveTable.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SharedTableCard accessToken="jwt" qrToken={null} />);

    await user.click(await screen.findByRole('button', { name: /salir de la mesa/i }));

    expect(apiMock.leaveTable).toHaveBeenCalledWith('jwt');
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Mesa 3' })).not.toBeInTheDocument());
  });

  it('esto lo pago yo: marca un pedido por cobrar de otra persona', async () => {
    apiMock.currentTable.mockResolvedValue(
      table({
        grupos: [
          { alias: 'Luis', soy_yo: false, total: '20.20', pagado: '0.00', pendiente: '20.20',
            pedidos: [{ id: null, folio: 7, estado: 'listo', items_resumen: '1× Torta', total: '20.20', pendiente_cobro: true, creado_en: 'a', pagara: null, lo_pago_yo: false }] },
        ],
      }),
    );
    apiMock.claimTableOrder.mockResolvedValue(
      table({
        grupos: [
          { alias: 'Luis', soy_yo: false, total: '20.20', pagado: '0.00', pendiente: '20.20',
            pedidos: [{ id: null, folio: 7, estado: 'listo', items_resumen: '1× Torta', total: '20.20', pendiente_cobro: true, creado_en: 'a', pagara: 'Ana', lo_pago_yo: true }] },
        ],
      }),
    );
    const user = userEvent.setup();
    render(<SharedTableCard accessToken="jwt" qrToken={null} />);

    await user.click(await screen.findByRole('button', { name: 'Esto lo pago yo' }));

    expect(apiMock.claimTableOrder).toHaveBeenCalledWith('jwt', 7, true);
    expect(await screen.findByRole('button', { name: /lo pago yo ✓/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('si otra persona ya lo paga, solo lo dice', async () => {
    apiMock.currentTable.mockResolvedValue(
      table({
        grupos: [
          { alias: 'Luis', soy_yo: false, total: '20.20', pagado: '0.00', pendiente: '20.20',
            pedidos: [{ id: null, folio: 7, estado: 'listo', items_resumen: '1× Torta', total: '20.20', pendiente_cobro: true, creado_en: 'a', pagara: 'Luis', lo_pago_yo: false }] },
        ],
      }),
    );
    render(<SharedTableCard accessToken="jwt" qrToken={null} />);
    expect(await screen.findByText('Paga Luis')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Esto lo pago yo' })).not.toBeInTheDocument();
  });

  it('invitado sin sesión: prellena su nombre y se une con la sesión de su alias', async () => {
    // Sin token no se consulta; tras unirse el servidor ya devuelve la mesa.
    apiMock.currentTable.mockResolvedValue(table());
    apiMock.joinTable.mockResolvedValue(table());
    const onEnsureToken = vi.fn().mockResolvedValue('guest-jwt');
    const user = userEvent.setup();
    render(
      <SharedTableCard
        accessToken={null}
        qrToken="qr-1"
        defaultAlias="Lupi"
        legalNote={<p>Aviso legal</p>}
        onEnsureToken={onEnsureToken}
      />,
    );

    expect(await screen.findByRole('textbox', { name: /tu nombre en la mesa/i })).toHaveValue('Lupi');
    expect(screen.getByText('Aviso legal')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /unirme a la mesa/i }));

    expect(onEnsureToken).toHaveBeenCalledWith('Lupi');
    expect(apiMock.joinTable).toHaveBeenCalledWith('guest-jwt', 'qr-1', 'Lupi');
    expect(await screen.findByRole('article', { name: 'Mesa 3' })).toBeInTheDocument();
  });

  it('sesión vencida avisa para renovarla sin borrar la mesa', async () => {
    const { VaiinillaApiError } = await import('../lib/api-error');
    apiMock.currentTable.mockResolvedValue(
      table({
        grupos: [
          { alias: 'Luis', soy_yo: false, total: '20.20', pagado: '0.00', pendiente: '20.20',
            pedidos: [{ id: null, folio: 7, estado: 'listo', items_resumen: '1× Torta', total: '20.20', pendiente_cobro: true, creado_en: 'a', pagara: null, lo_pago_yo: false }] },
        ],
      }),
    );
    apiMock.claimTableOrder.mockRejectedValue(
      new VaiinillaApiError(401, { code: 'UNAUTHENTICATED', message: 'x' }),
    );
    const onUnauthorized = vi.fn();
    const user = userEvent.setup();
    render(<SharedTableCard accessToken="jwt" qrToken={null} onUnauthorized={onUnauthorized} />);

    expect(await screen.findByRole('article', { name: 'Mesa 3' })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Esto lo pago yo' }));

    await waitFor(() => expect(onUnauthorized).toHaveBeenCalled());
    // La mesa que ya se veía no se borra por una operación fallida.
    expect(screen.getByRole('article', { name: 'Mesa 3' })).toBeInTheDocument();
  });
});
