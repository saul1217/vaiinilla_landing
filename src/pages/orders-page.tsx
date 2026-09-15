import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { PageShell } from '../components/shell';
import { useAuth } from '../context/auth-context';
import { useBuyerSession } from '../context/buyer-session';
import { useCart } from '../context/cart-context';
import { api } from '../lib/api';
import { lastPlaceSlug } from '../lib/last-place';
import { errorMessage } from '../lib/api-error';
import { formatMoney } from '../lib/money';
import type { OrderDetail, PublicEstablishment } from '../types/api';

const STATUS_LABEL: Record<OrderDetail['estado'], string> = {
  por_cobrar: 'Por cobrar',
  cobrado: 'Cobrado',
  preparando: 'Preparando',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  no_recogido: 'No recogido',
  expirado: 'Expirado',
};

export function OrdersPage() {
  const { user, ready } = useAuth();
  const { cart } = useCart();
  const { context, openClientSession } = useBuyerSession();
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [place, setPlace] = useState<PublicEstablishment | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const slug = cart?.slug ?? lastPlaceSlug();
    const run = async () => {
      try {
        let session = context;
        if (slug) {
          const nextPlace = await api.getEstablishment(slug);
          if (!active) return;
          setPlace(nextPlace);
          if (!session || session.contexto.establecimiento_id !== nextPlace.id) {
            session = await openClientSession(user, nextPlace);
          }
        }
        if (!session) {
          setError('Entra a una cafetería para ver tus pedidos de ese lugar.');
          return;
        }
        const result = await api.listOrders(session.access_token);
        if (active) setOrders(result.orders);
      } catch (cause) {
        if (active) setError(errorMessage(cause));
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [cart?.slug, context, openClientSession, user]);

  if (ready && !user) return <Navigate to="/cuenta?next=/cuenta/pedidos" replace />;

  return (
    <PageShell>
      <main id="main-content" className="app-page">
        <div className="container">
          <p className="eyebrow">Seguimiento</p>
          <h1>Tus pedidos{place ? ` · ${place.nombre}` : ''}</h1>
          <nav className="account-nav">
            <Link className="btn btn--ghost" to="/cuenta">
              Cuenta
            </Link>
            <Link className="btn btn--ghost" to="/cuenta/saldo">
              Saldo
            </Link>
          </nav>
          {error ? <p className="feedback">{error}</p> : null}
          {orders.length === 0 && !error ? (
            <div className="empty-state">Aún no hay pedidos en esta sesión.</div>
          ) : (
            <div className="card-grid">
              {orders.map((order) => (
                <article className="place-card" key={order.id}>
                  <span className="status-pill">{STATUS_LABEL[order.estado]}</span>
                  <h2>Folio {order.folio}</h2>
                  <p>{formatMoney(order.total)}</p>
                  <Link className="btn btn--primary" to={`/cuenta/pedidos/${order.id}`}>
                    Ver seguimiento
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </PageShell>
  );
}

export { STATUS_LABEL };
