import { clearCart } from './cart-storage';
import { releasePlace } from './last-place';
import { forgetSpace } from './space-session';
import { forgetTableParticipant } from './table-participant';

/**
 * "Cambiar tienda": el dispositivo suelta la tienda recordada, el espacio escaneado, la
 * participación en mesa y el carrito guardado, para que Menú y Pedidos no regresen a la
 * tienda anterior. Las sesiones de cliente ya no la recuerdan de vuelta hasta que se elija otra.
 * Los pedidos ya hechos no se tocan: viven en la cuenta o en la llave de invitado.
 */
export function leavePlace(): void {
  releasePlace();
  forgetSpace();
  forgetTableParticipant();
  clearCart();
}
