// "Tus pedidos" sin cuenta: los pedidos en vivo de este navegador en la tienda,
// con el mismo seguimiento (estado, artículos, total) que un registrado ve en
// /cuenta/pedidos. Cada tarjeta enlaza a su seguimiento por enlace.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { OrderTrackCard } from './order-track-card';
import { trackingPath } from '../lib/guest-orders';
import type { OrderDetail } from '../types/api';

export function GuestLiveOrders({
  orders,
  imageFor,
}: {
  orders: OrderDetail[];
  imageFor?: (order: OrderDetail) => string | null;
}) {
  const [expandedToken, setExpandedToken] = useState<string | null>(null);
  if (orders.length === 0) return null;
  return (
    <section className="alumno-guest-live" aria-label="Tus pedidos en curso">
      <h2 className="alumno-section-label alumno-section-label--live">Tus pedidos</h2>
      <div className="alumno-order-list alumno-arrive">
        {orders.map((order) => {
          const token = order.seguimiento_token ?? null;
          const expanded = token !== null && expandedToken === token;
          return (
            <div key={order.id} className="alumno-guest-live__item">
              <OrderTrackCard
                order={order}
                expanded={expanded}
                onToggle={() =>
                  setExpandedToken((current) => (current === token ? null : token))
                }
                completeLink={false}
                imageUrl={imageFor?.(order) ?? null}
                pickupToken={order.qr_token ?? null}
              />
              {token ? (
                <Link className="alumno-guest-live__link" to={trackingPath(token)}>
                  Ver seguimiento →
                </Link>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
