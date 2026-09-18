import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { OrderTrackCard } from '../components/order-track-card';
import { useAuth } from '../context/auth-context';
import { useBuyerSession } from '../context/buyer-session';
import { useCart } from '../context/cart-context';
import { api } from '../lib/api';
import { lastPlaceSlug } from '../lib/last-place';
import { errorMessage } from '../lib/api-error';
import { catalogImageMap, orderThumbUrl } from '../lib/catalog-images';
import { persistPickupQrFromOrder } from '../lib/pickup-qr';
import { isActiveOrderStatus } from '../lib/order-labels';
import { usePickupQrToken } from '../lib/use-pickup-qr';
import type { CatalogProduct, OrderDetail, PublicEstablishment } from '../types/api';

const POLL_MS = 5000;

export function OrdersPage() {
  const { user, ready } = useAuth();
  const { cart } = useCart();
  const { context, openClientSession } = useBuyerSession();
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [place, setPlace] = useState<PublicEstablishment | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const deskPane = useDeskPane();
  const thumbImages = catalogImageMap(catalogProducts);

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
          void api.getGuestCatalog(slug).then((catalog) => {
            if (active) setCatalogProducts(catalog.productos);
          }).catch(() => undefined);
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
        result.orders.forEach((item) => persistPickupQrFromOrder(item));
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

  useEffect(() => {
    if (!deskPane || expandedId || orders.length === 0) return;
    const firstActive = orders.find((item) => isActiveOrderStatus(item.estado));
    setExpandedId(firstActive?.id ?? orders[0]?.id ?? null);
  }, [deskPane, expandedId, orders]);

  const selected = orders.find((order) => order.id === expandedId) ?? null;
  const pickupToken = usePickupQrToken(selected, context?.access_token ?? null);

  if (ready && !user) return <Navigate to="/cuenta?next=/cuenta/pedidos" replace />;

  const activeOrders = orders.filter((order) => isActiveOrderStatus(order.estado));
  const pastOrders = orders.filter((order) => !isActiveOrderStatus(order.estado));

  function toggle(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  return (
    <AppShell tab="orders">
      <main id="main-content" className="alumno-main">
        <AlumnoPageHeader title="Mis pedidos" />
        {place?.nombre ? <p className="alumno-place-name">{place.nombre}</p> : null}
        {error ? <p className="alumno-error">{error}</p> : null}
        {loading && orders.length === 0 && !error ? <p role="status">Cargando pedidos…</p> : null}
        {orders.length === 0 && !error && !loading ? (
          <div className="alumno-empty">
            <img src="/vaini/cutout-frente.png" alt="" />
            <p>Aún no hay pedidos en esta sesión.</p>
          </div>
        ) : (
          <div className="alumno-orders-desk">
            <div className="alumno-orders-desk__list">
              {activeOrders.length > 0 ? (
                <section aria-labelledby="orders-live">
                  <h2 className="alumno-section-label alumno-section-label--live" id="orders-live">
                    En curso
                  </h2>
                  <div className="alumno-order-list">
                    {activeOrders.map((order) => (
                      <OrderTrackCard
                        key={order.id}
                        order={order}
                        expanded={expandedId === order.id}
                        onToggle={() => toggle(order.id)}
                        imageUrl={orderThumbUrl(order, thumbImages, catalogProducts)}
                        pickupToken={expandedId === order.id ? pickupToken : null}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
              {pastOrders.length > 0 ? (
                <section aria-labelledby="orders-past">
                  <h2 className="alumno-section-label" id="orders-past">
                    Anteriores
                  </h2>
                  <div className="alumno-order-list">
                    {pastOrders.map((order) => (
                      <OrderTrackCard
                        key={order.id}
                        order={order}
                        expanded={expandedId === order.id}
                        onToggle={() => toggle(order.id)}
                        imageUrl={orderThumbUrl(order, thumbImages, catalogProducts)}
                        pickupToken={expandedId === order.id ? pickupToken : null}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
            {deskPane ? (
              <aside className="alumno-orders-desk__detail">
                {selected ? (
                  <OrderTrackCard
                    order={selected}
                    expanded
                    completeLink
                    toggle={false}
                    onToggle={() => undefined}
                    imageUrl={orderThumbUrl(selected, thumbImages, catalogProducts)}
                    pickupToken={pickupToken}
                  />
                ) : (
                  <div className="alumno-orders-desk__hint">
                    <img src="/vaini/cutout-frente.png" alt="" />
                    <p>Elige un pedido para ver el seguimiento.</p>
                  </div>
                )}
              </aside>
            ) : null}
          </div>
        )}
      </main>
    </AppShell>
  );
}

function useDeskPane() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setWide(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return wide;
}
