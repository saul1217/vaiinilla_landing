// "Tu pedido en curso": los pedidos sin cuenta hechos en este navegador. Atajo al
// enlace de seguimiento; no sustituye guardarlo (en otro dispositivo no aparece).
// Los que ya se ven en vivo ("Tus pedidos") se excluyen para no duplicarlos.
import { Link } from 'react-router-dom';
import { readGuestOrders, trackingPath } from '../lib/guest-orders';

export function GuestOrdersBanner({ slug, excludeTokens }: { slug?: string; excludeTokens?: Iterable<string> }) {
  const excluded = new Set(excludeTokens ?? []);
  const orders = readGuestOrders()
    .filter((o) => !slug || o.slug === slug)
    .filter((o) => !excluded.has(o.token))
    .slice(0, 3);
  if (orders.length === 0) return null;
  return (
    <section className="alumno-guest-orders" aria-label="Tus pedidos sin cuenta">
      {orders.map((order) => (
        <Link key={order.token} className="alumno-guest-orders__item" to={trackingPath(order.token)}>
          <span>
            <strong>Tu pedido #{order.folio}</strong>
            <small>{order.placeName}</small>
          </span>
          <span aria-hidden="true">Ver seguimiento →</span>
        </Link>
      ))}
    </section>
  );
}
