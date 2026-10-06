export interface SplashContext {
  kicker: string;
  line: string;
}

/** Por qué se pide la cuenta aquí: quien llega desde Cartera o al pagar no ve un splash genérico. */
export function splashContextFor(next: string, cartAmount: string | null): SplashContext | null {
  const pathname = next.split(/[?#]/)[0] ?? next;
  if (pathname === '/cuenta/saldo') {
    return { kicker: 'Cartera', line: 'Tu saldo vive en tu cuenta. Puedes seguir pidiendo sin cuenta.' };
  }
  if (/^\/e\/[^/]+\/carrito\/?$/.test(pathname)) {
    return {
      kicker: 'Tu pedido',
      line: cartAmount ? `Entra para pagar tu pedido de ${cartAmount}.` : 'Entra para pagar tu pedido.',
    };
  }
  if (/^\/e\/[^/]+\/canchas\/?$/.test(pathname)) {
    return { kicker: 'Canchas', line: 'Entra para apartar tu cancha. Así la reserva queda a tu nombre.' };
  }
  if (/^\/cuenta\/pedidos\/[^/]+\/?$/.test(pathname)) {
    return { kicker: 'Pedido', line: 'Entra para ver este pedido.' };
  }
  return null;
}
