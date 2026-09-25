// In-memory waiter/buyer backend for /__qa screens and tests: follows the
// contract in docs/mesero-backend.md, including 409 when a call was already taken.
import { VaiinillaApiError } from './api-error';
import type { Board, BoardOrder, BoardTable, BuyerCallClient, CallReason, TableCall, WaiterClient } from './mesero-api';

const ago = (s: number) => new Date(Date.now() - s * 1000).toISOString();

function order(id: string, folio: number, estado: BoardOrder['estado'], nombre: string, items: string): BoardOrder {
  return { id, folio, estado, version: 3, cliente: { nombre }, items_resumen: items, actualizado_en: ago(60) };
}

function call(id: string, espacio: BoardTable['espacio'], motivo: CallReason, seconds: number, nombre: string): TableCall {
  return { id, espacio, pedido_id: null, motivo, estado: 'pendiente', cliente: { nombre }, tomada_por: null, creado_en: ago(seconds), tomada_en: null, cerrada_en: null, version: 1 };
}

export function createMockWaiterClient(): WaiterClient & { ring(tableId: number): void } {
  const space = (id: number) => ({ id, nombre: `Mesa ${id}`, tipo: 'mesa' });
  const tables: BoardTable[] = Array.from({ length: 12 }, (_, i) => ({ espacio: space(i + 1), llamada: null, pedidos: [] }));
  const at = (id: number) => tables[id - 1]!;
  at(4).llamada = call('c4', space(4), 'utensilios', 42, 'Ana');
  at(4).pedidos = [order('p4', 305, 'preparando', 'Ana', '2× Taco de cochinita')];
  at(12).llamada = call('c12', space(12), 'problema', 130, 'Leo');
  at(12).pedidos = [order('p12', 298, 'entregado', 'Leo', '1× Pozole')].filter((o) => o.estado !== 'entregado');
  at(7).pedidos = [order('p7', 312, 'listo', 'Sofía', '1× Chilaquiles verdes, 1× Café americano')];
  at(5).pedidos = [order('p5', 309, 'listo', 'Iván', '3× Taquitos de trompo')];
  at(2).pedidos = [order('p2a', 314, 'preparando', 'Mar', '1× Fettuccine'), order('p2b', 315, 'cobrado', 'Tere', '1× Panqueques')];
  at(9).pedidos = [order('p9', 316, 'cobrado', 'Raúl', '1× Huevos benedictinos')];

  const snapshot = (): Board => ({ tables: structuredClone(tables), callsEnabled: true });
  const wait = () => new Promise((resolve) => setTimeout(resolve, 280));

  return {
    async board() {
      await wait();
      return snapshot();
    },
    async transitionCall(target, next) {
      await wait();
      const table = tables.find((t) => t.llamada?.id === target.id);
      if (!table?.llamada || table.llamada.version !== target.version) {
        throw new VaiinillaApiError(409, { code: 'VERSION_CONFLICT', message: 'Otro mesero ya tomó esta llamada.' });
      }
      if (next === 'atendida') {
        const closed = { ...table.llamada, estado: 'atendida' as const, cerrada_en: new Date().toISOString(), version: table.llamada.version + 1 };
        table.llamada = null;
        return closed;
      }
      table.llamada = { ...table.llamada, estado: 'en_camino', tomada_por: { usuario_id: 'yo', nombre: 'Luis' }, tomada_en: new Date().toISOString(), version: table.llamada.version + 1 };
      return table.llamada;
    },
    async deliver(target, token) {
      await wait();
      if (token.trim().length < 3) throw new VaiinillaApiError(422, { code: 'INVALID_QR_TOKEN', message: 'El código no coincide con el pedido.' });
      for (const table of tables) table.pedidos = table.pedidos.filter((o) => o.id !== target.id);
    },
    ring(tableId) {
      at(tableId).llamada = call(`c${tableId}-${Date.now()}`, space(tableId), 'atencion', 0, 'Cliente');
    },
  };
}

export function createMockBuyerCallClient(): BuyerCallClient {
  let open: TableCall | null = null;
  const wait = () => new Promise((resolve) => setTimeout(resolve, 350));
  return {
    async current() {
      await wait();
      return open;
    },
    async call(espacioId, motivo) {
      await wait();
      open = call('buyer', { id: espacioId, nombre: `Mesa ${espacioId}`, tipo: 'mesa' }, motivo, 0, 'Tú');
      const mine = open;
      // the waiter answers a few seconds later
      setTimeout(() => {
        if (open === mine) open = { ...mine, estado: 'en_camino', tomada_por: { usuario_id: 'm', nombre: 'Luis' }, tomada_en: new Date().toISOString(), version: 2 };
      }, 6000);
      return open;
    },
    async cancel(target) {
      await wait();
      open = null;
      return { ...target, estado: 'cancelada' };
    },
  };
}
