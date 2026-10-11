import { forgetPlace } from './last-place';
import { forgetSpace } from './space-session';
import { forgetTableParticipant } from './table-participant';

/**
 * "Cambiar tienda": el dispositivo suelta la tienda recordada, el espacio escaneado y la
 * participación en mesa, para que Menú y Pedidos no regresen a la tienda anterior.
 * Los pedidos ya hechos no se tocan: viven en la cuenta o en la llave de invitado.
 */
export function leavePlace(): void {
  forgetPlace();
  forgetSpace();
  forgetTableParticipant();
}
