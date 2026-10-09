import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SharedTable } from '../types/api';
import { SharedTableCard } from './shared-table-card';

const apiMock = vi.hoisted(() => ({ currentTable: vi.fn(), joinTable: vi.fn(), leaveTable: vi.fn(), claimTableOrder: vi.fn() }));
vi.mock('../lib/api', () => ({ api: apiMock }));

const ZERO = { total: '0.00', pagado: '0.00', pendiente: '0.00' };

function order(folio: number, extra = {}) {
  return { id: null, folio, estado: 'listo' as const, items_resumen: `1× Plato ${folio}`, total: '20.00', pendiente_cobro: false, creado_en: `t${folio}`, ...extra };
}

function table(): SharedTable {
  return {
    espacio: { id: 3, nombre: 'Mesa 3', tipo: 'mesa' },
    sesion_id: 'ses-1',
    mi_alias: 'Ana',
    mi_participante: { id: 'p-ana', alias: 'Ana' },
    cuenta_abierta: true,
    participantes: [
      { id: 'p-d1', alias: 'David', soy_yo: false, unido_en: null },
      { id: 'p-d2', alias: 'David', soy_yo: false, unido_en: null },
      { id: 'p-ana', alias: 'Ana', soy_yo: true, unido_en: null },
    ],
    grupos: [
      { alias: 'David', participante_id: 'p-d1', soy_yo: false, total: '20.00', pagado: '0.00', pendiente: '20.00', pedidos: [order(1)] },
      { alias: 'David', participante_id: 'p-d2', soy_yo: false, total: '20.00', pagado: '0.00', pendiente: '20.00', pedidos: [order(2)] },
      { alias: null, participante_id: null, soy_yo: false, total: '20.00', pagado: '0.00', pendiente: '20.00', pedidos: [order(3)] },
      { alias: 'Ana', participante_id: 'p-ana', soy_yo: true, total: '10.00', pagado: '0.00', pendiente: '10.00', pedidos: [order(4)] },
    ],
    totales: { total: '70.00', pagado: '0.00', pendiente: '70.00' },
    mi_parte: { total: '10.00', pagado: '0.00', pendiente: '10.00' },
  };
}

describe('mesa agrupada por participante', () => {
  beforeEach(() => {
    localStorage.clear();
    apiMock.currentTable.mockReset();
  });

  it('dos tocayos salen por separado (por id, no por alias)', async () => {
    apiMock.currentTable.mockResolvedValue(table());
    render(<SharedTableCard accessToken="jwt" qrToken={null} />);
    expect(await screen.findByRole('article', { name: 'Mesa 3' })).toBeInTheDocument();
    // Dos grupos "David": uno por cada participante.
    expect(screen.getAllByRole('heading', { name: 'David' })).toHaveLength(2);
  });

  it('el grupo sin participante sale como "Otros en la mesa"', async () => {
    apiMock.currentTable.mockResolvedValue({ ...table(), grupos: [
      { alias: null, participante_id: null, soy_yo: false, ...ZERO, pedidos: [order(9)] },
    ] });
    render(<SharedTableCard accessToken="jwt" qrToken={null} />);
    expect(await screen.findByRole('heading', { name: /otros en la mesa/i })).toBeInTheDocument();
  });

  it('si la sesión cambió, la identidad local se borra al refrescar', async () => {
    localStorage.setItem(
      'vaiinilla.buyer.table-participant.v1',
      JSON.stringify({ slug: 'demo-a', espacioId: 3, sesionId: 'ses-vieja', participanteId: 'p-x', alias: 'X' }),
    );
    apiMock.currentTable.mockResolvedValue(table());
    render(<SharedTableCard accessToken="jwt" qrToken={null} />);
    await waitFor(() => expect(apiMock.currentTable).toHaveBeenCalled());
    expect(localStorage.getItem('vaiinilla.buyer.table-participant.v1')).toBeNull();
  });
});
