// "Tu pedido en curso": los pedidos sin cuenta hechos en este navegador. Atajo a
// Mis pedidos (la pestaña Pedidos, igual que una cuenta); no sustituye guardar el
// enlace (en otro dispositivo no aparece).
// Los que ya se ven en vivo ("Tus pedidos") se excluyen para no duplicarlos.
// Cada enlace se comprueba contra el seguimiento: si el pedido ya no existe (404/410)
// o ya terminó sin entregarse (cancelado, expirado), el enlace se borra.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { isGoneTracking, isSettledOrder } from '../lib/guest-order-check';
import { forgetGuestOrderByToken, readGuestOrders } from '../lib/guest-orders';

export function GuestOrdersBanner({ slug, excludeTokens }: { slug?: string; excludeTokens?: Iterable<string> }) {
  const [, setVersion] = useState(0);
  const excluded = new Set(excludeTokens ?? []);
  const orders = readGuestOrders()
    .filter((o) => !slug || o.slug === slug)
    .filter((o) => !excluded.has(o.token))
    .slice(0, 3);
  const key = orders.map((o) => o.token).join('|');

  useEffect(() => {
    if (!key) return;
    let active = true;
    for (const token of key.split('|')) {
      void (async () => {
        try {
          const order = await api.getTracking(token);
          if (!isSettledOrder(order)) return;
        } catch (cause) {
          if (!isGoneTracking(cause)) return;
        }
        forgetGuestOrderByToken(token);
        if (active) setVersion((v) => v + 1);
      })();
    }
    return () => {
      active = false;
    };
  }, [key]);

  if (orders.length === 0) return null;
  return (
    <section className="alumno-guest-orders" aria-label="Tus pedidos sin cuenta">
      {orders.map((order) => (
        <Link key={order.token} className="alumno-guest-orders__item" to={`/cuenta/pedidos?nuevo=${order.token}`}>
          <span>
            <strong>Tu pedido #{order.folio}</strong>
            <small>{order.placeName}</small>
          </span>
          <span aria-hidden="true">Ver mis pedidos →</span>
        </Link>
      ))}
    </section>
  );
}
