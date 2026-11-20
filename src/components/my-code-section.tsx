import { Link } from 'react-router-dom';
import { OrderPickupPanel } from './order-pickup-panel';
import { ORDER_STATUS_LABEL } from '../lib/order-labels';
import { myCodeOrders, resolvePickupQrToken, type PickupRules } from '../lib/pickup-qr';
import type { OrderDetail } from '../types/api';

/** Fecha local YYYY-MM-DD: la de los pedidos del día. */
function localToday(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * «Mi código»: los pedidos de hoy con lo que el cliente enseña en la barra o en caja, en el orden en
 * que los necesita (listos, por pagar en caja, en preparación y entregados). Cada uno respeta cómo
 * valida el negocio: solo código, solo QR o los dos.
 */
export function MyCodeSection({
  orders,
  rules,
  slug,
  now = new Date(),
}: {
  orders: OrderDetail[];
  rules?: PickupRules;
  slug: string | null;
  now?: Date;
}) {
  const list = myCodeOrders(orders, localToday(now));
  return (
    <section className="alumno-mycode" aria-labelledby="mi-codigo">
      <h2 className="alumno-section-label alumno-section-label--live" id="mi-codigo">Mi código</h2>
      {list.length === 0 ? (
        <p className="alumno-mycode__empty">Hoy no tienes pedidos. Cuando pidas, tu código aparece aquí.</p>
      ) : (
        <ol className="alumno-mycode__list">
          {list.map((order) => (
            <li key={order.id} className="alumno-mycode__item">
              <p className="alumno-mycode__state">
                <strong>#{order.folio}</strong> · {ORDER_STATUS_LABEL[order.estado]}
              </p>
              <OrderPickupPanel
                order={order}
                token={resolvePickupQrToken(order)}
                stripeOrder={order.metodo_pago === 'stripe'}
                rules={rules}
              />
              <Link className="alumno-mycode__detail" to={`/cuenta/pedidos/${order.id}`}>Ver el pedido</Link>
            </li>
          ))}
        </ol>
      )}
      <p className="alumno-mycode__rescan">
        ¿Cambiaste de mesa o de barra? Escanea su QR con la cámara de tu teléfono
        {slug ? <> o <Link to={`/e/${slug}`}>vuelve al menú</Link></> : null}.
      </p>
    </section>
  );
}
