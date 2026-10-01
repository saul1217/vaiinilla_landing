// Cliente de "Ya llegué" (drive-thru). Contrato: vaiinilla_back docs/ya-llegue.md.
import type { OrderDetail } from '../types/api';
import { api } from './api';

export interface ArrivalClient {
  isDriveThru: () => Promise<boolean>;
  announce: (orderId: string) => Promise<OrderDetail>;
}

export function createArrivalClient(token: string): ArrivalClient {
  return {
    isDriveThru: async () => (await api.getOperationalStatus(token)).tipo === 'drive_thru',
    announce: (orderId) => api.announceArrival(token, orderId),
  };
}
