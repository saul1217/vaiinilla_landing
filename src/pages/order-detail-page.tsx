import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { PageShell } from '../components/shell';
import { useAuth } from '../context/auth-context';
import { useBuyerSession } from '../context/buyer-session';
import { useCart } from '../context/cart-context';
import { api } from '../lib/api';
import { lastPlaceSlug } from '../lib/last-place';
import { errorMessage } from '../lib/api-error';
import { formatMoney } from '../lib/money';
import type { OrderDetail } from '../types/api';
import { STATUS_LABEL } from './orders-page';

const FLOW: OrderDetail['estado'][] = ['por_cobrar', 'cobrado', 'preparando', 'listo', 'entregado'];

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const { user, ready } = useAuth();
  const { cart } = useCart();
  const { context, openClientSession } = useBuyerSession();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const run = async () => {
      try {
        let session = context;
        const slug = cart?.slug ?? lastPlaceSlug();
        if (!session && slug) {
          const place = await api.getEstablishment(slug);
          session = await openClientSession(user, place);
        }
        if (!session) {
          setError('Abre una sesión de cafetería para consultar este pedido.');
          return;
        }
        const next = await api.getOrder(session.access_token, id);
        if (active) setOrder(next);
      } catch (cause) {
        if (active) setError(errorMessage(cause));
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [cart?.slug, context, id, openClientSession, user]);

  if (ready && !user) return <Navigate to={`/cuenta?next=/cuenta/pedidos/${id}`} replace />;

  const currentIndex = order ? FLOW.indexOf(order.estado) : -1;

  return (
    <PageShell>
      <main id="main-content" className="app-page">
        <div className="container" style={{ maxWidth: 720 }}>
          <p className="eyebrow">Pedido</p>
          <h1>{order ? `Folio ${order.folio}` : 'Seguimiento'}</h1>
          {error ? <p className="feedback">{error}</p> : null}
          {order ? (
            <section className="panel-card">
              <p>
                <span className="status-pill">{STATUS_LABEL[order.estado]}</span>
              </p>
              <p>
                {order.metodo_pago === 'saldo' ? 'Pagado con saldo' : 'Efectivo al recoger'} · para llevar
              </p>
              <p>
                <strong>{formatMoney(order.total)}</strong>
              </p>
              <ol className="order-steps">
                {FLOW.map((step, index) => (
                  <li key={step} className={currentIndex >= index ? 'is-done' : undefined}>
                    {STATUS_LABEL[step]}
                  </li>
                ))}
              </ol>
              <ul>
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.cantidad} × {item.nombre_producto} — {formatMoney(item.subtotal)}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <p style={{ marginTop: 24 }}>
            <Link className="btn btn--ghost" to="/cuenta/pedidos">
              Todos los pedidos
            </Link>
          </p>
        </div>
      </main>
    </PageShell>
  );
}
