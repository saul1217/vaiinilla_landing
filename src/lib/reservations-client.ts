import { api } from './api';
import type { ReservationsClient } from './use-reservations';

/** Cliente HTTP real de las reservas: el token del contexto del cliente va en cada llamada. */
export function createReservationsClient(token: string): ReservationsClient {
  return {
    day: (date) => api.getCourtDay(token, date),
    list: () => api.listReservations(token),
    create: (input, key) => api.createReservation(token, input, key),
    pay: (id, method, key) => api.payReservation(token, id, method, key),
    cancel: (id, key) => api.cancelReservation(token, id, key),
  };
}
