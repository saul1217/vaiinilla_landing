import { useState } from 'react';
import { Link } from 'react-router-dom';
import { trackingPath } from '../lib/guest-orders';
import type { OrderSessionGroup } from '../lib/session-orders';
import { CallWaiter } from './call-waiter';

function sessionTime(startedAt: string | null, closedAt: string | null): string | null {
  if (!startedAt) return null;
  const started = new Date(startedAt);
  if (!Number.isFinite(started.getTime())) return null;
  const day = started.toDateString() === new Date().toDateString()
    ? 'Hoy'
    : new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(started);
  const time = new Intl.DateTimeFormat('es-MX', { hour: 'numeric', minute: '2-digit' });
  if (!closedAt) return `${day} · ${time.format(started)}`;
  const closed = new Date(closedAt);
  return Number.isFinite(closed.getTime())
    ? `${day} · ${time.format(started)} – ${time.format(closed)}`
    : `${day} · ${time.format(started)}`;
}

/** Una tarjeta principal por estancia; los folios individuales solo aparecen al abrirla. */
export function SessionOrdersCard({
  group,
  initialExpanded = false,
}: {
  group: OrderSessionGroup;
  initialExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const products = group.orders.flatMap((order) =>
    order.items.map((item) => `${item.cantidad}× ${item.nombre_producto}`),
  );
  const started = sessionTime(group.startedAt, group.closedAt);
  return (
    <article className="alumno-track-card alumno-session-order" aria-label={`Pedidos de ${group.spaceName}`}>
      <header className="alumno-track-card__top">
        <span className="alumno-track-card__folio">{group.spaceName}{started ? ` · ${started}` : ''}</span>
        <span className="alumno-track-card__pill">{group.orders.length} {group.orders.length === 1 ? 'pedido' : 'pedidos'}</span>
      </header>
      <ul className="alumno-ticket-items alumno-session-order__products">
        {products.map((label, index) => <li key={`${index}:${label}`}><span>{label}</span></li>)}
      </ul>
      {group.sessionState === 'abierta' && group.space ? (
        <CallWaiter space={group.space} allowAccountRequest />
      ) : null}
      {group.sessionState === 'abierta' ? (
        <Link className="alumno-btn alumno-btn--ghost" to="/cuenta/pedidos#mesa-activa">Ver mesa</Link>
      ) : null}
      <button
        className="alumno-track-card__toggle"
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? 'Ocultar pedidos de la sesión' : 'Ver pedidos de la sesión'}
      </button>
      {expanded ? (
        <ul className="alumno-session-order__details">
          {group.orders.map((order) => (
            <li key={order.id}>
              <span>
                <strong>Pedido #{order.folio}</strong>
                <small>{order.items.map((item) => `${item.cantidad}× ${item.nombre_producto}`).join(' · ')}</small>
              </span>
              {order.seguimiento_token ? (
                <Link to={trackingPath(order.seguimiento_token)}>Ver seguimiento</Link>
              ) : (
                <Link to={`/cuenta/pedidos/${order.id}`}>Ver pedido</Link>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
