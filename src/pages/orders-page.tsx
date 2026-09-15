import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { useAuth } from '../context/auth-context';
import { useBuyerSession } from '../context/buyer-session';
import { useCart } from '../context/cart-context';
import { api } from '../lib/api';
import { lastPlaceSlug } from '../lib/last-place';
import { errorMessage } from '../lib/api-error';
import { formatMoney } from '../lib/money';
import { ORDER_STATUS_LABEL, orderDestinationLabel, orderStatusTone } from '../lib/order-labels';
import type { OrderDetail, PublicEstablishment } from '../types/api';

const POLL_MS = 5000;

export function OrdersPage() {
  const { user, ready } = useAuth();
  const { cart } = useCart();
  const { context, openClientSession } = useBuyerSession();
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [place, setPlace] = useState<PublicEstablishment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const slug = cart?.slug ?? lastPlaceSlug();
    const run = async (silent = false) => {
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
          setLoading(false);
          return;
        }
        const result = await api.listOrders(session.access_token);
        if (!active) return;
        setOrders(result.orders);
        setError(null);
      } catch (cause) {
        if (active && !silent) setError(errorMessage(cause));
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    const timer = window.setInterval(() => {
      void run(true);
    }, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [cart?.slug, context, openClientSession, user]);

  if (ready && !user) return <Navigate to="/cuenta?next=/cuenta/pedidos" replace />;

  return (
    <AppShell tab="orders">
      <main id="main-content" className="alumno-main">
        <AlumnoPageHeader kicker="Seguimiento" title="Pedidos" lead={place?.nombre} />
        {error ? <p className="alumno-error">{error}</p> : null}
        {loading && orders.length === 0 && !error ? <p role="status">Cargando pedidos…</p> : null}
        {orders.length === 0 && !error && !loading ? (
          <div className="alumno-empty">
            <img src="/vaini/cutout-frente.png" alt="" />
            <p>Aún no hay pedidos en esta sesión.</p>
          </div>
        ) : (
          <div className="alumno-order-list">
            {orders.map((order) => (
              <Link className="alumno-order-card" key={order.id} to={`/cuenta/pedidos/${order.id}`}>
                <span className={`alumno-status alumno-status--${orderStatusTone(order.estado)}`}>
                  {ORDER_STATUS_LABEL[order.estado]}
                </span>
                <strong>Folio {order.folio}</strong>
                <span className="alumno-muted">{orderDestinationLabel(order)}</span>
                <span className="alumno-order-card__total">{formatMoney(order.total)}</span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}
