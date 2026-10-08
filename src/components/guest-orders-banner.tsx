// Enlaces de seguimiento guardados. Son una referencia recuperable, no una señal
// de que el pedido o la sesión de mesa sigan activos.
import { Link } from 'react-router-dom';
import { readGuestOrders } from '../lib/guest-orders';

export function GuestOrdersBanner({ slug, excludeTokens }: { slug?: string; excludeTokens?: Iterable<string> }) {
  const excluded = new Set(excludeTokens ?? []);
  const orders = readGuestOrders()
    .filter((o) => !slug || o.slug === slug)
    .filter((o) => !excluded.has(o.token))
    .slice(0, 3);
  if (orders.length === 0) return null;
  return (
    <section className="alumno-guest-orders" aria-label="Seguimientos guardados">
      {orders.map((order) => (
        <Link key={order.token} className="alumno-guest-orders__item" to={`/seguimiento/${order.token}`}>
          <span>
            <strong>Seguimiento guardado · Pedido #{order.folio}</strong>
            <small>{order.placeName}</small>
          </span>
          <span aria-hidden="true">Abrir seguimiento →</span>
        </Link>
      ))}
    </section>
  );
}
