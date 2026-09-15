import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { AppShell } from '../components/app-shell';
import { useAuth } from '../context/auth-context';
import { useBuyerSession } from '../context/buyer-session';
import { useCart } from '../context/cart-context';
import { api } from '../lib/api';
import { lastPlaceSlug } from '../lib/last-place';
import { errorMessage } from '../lib/api-error';
import { formatMoney } from '../lib/money';
import {
  isTerminalOrderStatus,
  ORDER_FLOW,
  ORDER_STATUS_LABEL,
  orderDestinationLabel,
  orderPayLabel,
  orderStatusTone,
} from '../lib/order-labels';
import type { OrderDetail } from '../types/api';

const POLL_MS = 5000;

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const { user, ready } = useAuth();
  const { cart } = useCart();
  const { context, openClientSession } = useBuyerSession();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const orderRef = useRef<OrderDetail | null>(null);
  orderRef.current = order;

  useEffect(() => {
    if (!user) return;
    let active = true;
    const run = async (silent = false) => {
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
        if (!active) return;
        setOrder(next);
        setError(null);
      } catch (cause) {
        if (active && !silent) setError(errorMessage(cause));
      }
    };
    void run();
    const timer = window.setInterval(() => {
      const current = orderRef.current;
      if (current && isTerminalOrderStatus(current.estado)) return;
      void run(true);
    }, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [cart?.slug, context, id, openClientSession, user]);

  useEffect(() => {
    if (!order?.qr_token) {
      setQr(null);
      return;
    }
    let active = true;
    void QRCode.toDataURL(order.qr_token, { margin: 1, width: 280 }).then((next) => {
      if (active) setQr(next);
    });
    return () => {
      active = false;
    };
  }, [order?.qr_token]);

  if (ready && !user) return <Navigate to={`/cuenta?next=/cuenta/pedidos/${id}`} replace />;

  const currentIndex = order ? ORDER_FLOW.indexOf(order.estado) : -1;

  return (
    <AppShell tab="orders">
      <main id="main-content" className="alumno-main">
        <p className="alumno-kicker">Pedido</p>
        <h1>{order ? `Folio ${order.folio}` : 'Seguimiento'}</h1>
        {error ? <p className="alumno-error">{error}</p> : null}
        {order ? (
          <section className="alumno-card alumno-card--ticket">
            <p>
              <span className={`alumno-status alumno-status--${orderStatusTone(order.estado)}`}>
                {ORDER_STATUS_LABEL[order.estado]}
              </span>
            </p>
            <p className="alumno-muted">
              {orderPayLabel(order.metodo_pago)} · {orderDestinationLabel(order)}
            </p>
            <p className="alumno-wallet-balance" style={{ fontSize: '1.6rem', margin: '8px 0 12px' }}>
              {formatMoney(order.total)}
            </p>
            {qr ? (
              <div className="alumno-card--qr">
                <img className="wallet-qr" src={qr} alt="Código QR del pedido para mostrar en caja" />
                <p className="alumno-muted">Muéstralo en caja o cocina para entregar.</p>
              </div>
            ) : null}
            <ol className="alumno-steps">
              {ORDER_FLOW.map((step, index) => (
                <li key={step} className={currentIndex >= index ? 'is-done' : undefined}>
                  {ORDER_STATUS_LABEL[step]}
                </li>
              ))}
            </ol>
            <ul className="alumno-ticket-items">
              {order.items.map((item) => (
                <li key={item.id}>
                  <span>
                    {item.cantidad} × {item.nombre_producto}
                  </span>
                  <strong>{formatMoney(item.subtotal)}</strong>
                </li>
              ))}
            </ul>
            {order.notas_cocina ? <p className="alumno-muted">Nota: {order.notas_cocina}</p> : null}
          </section>
        ) : null}
        <p style={{ marginTop: 24 }}>
          <Link className="alumno-btn alumno-btn--ghost" to="/cuenta/pedidos">
            Todos los pedidos
          </Link>
        </p>
      </main>
    </AppShell>
  );
}
