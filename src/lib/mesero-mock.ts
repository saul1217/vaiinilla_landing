// In-memory buyer backend for /__qa screens and tests: follows the contract in
// vaiinilla_back docs/llamadas-mesa.md.
import type { BuyerCallClient, CallReason, TableCall } from './mesero-api';

const ago = (s: number) => new Date(Date.now() - s * 1000).toISOString();

function call(id: string, espacio: TableCall['espacio'], motivo: CallReason, seconds: number, nombre: string): TableCall {
  return { id, espacio, pedido_id: null, motivo, estado: 'pendiente', cliente: { nombre }, tomada_por: null, creado_en: ago(seconds), tomada_en: null, cerrada_en: null, version: 1 };
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
