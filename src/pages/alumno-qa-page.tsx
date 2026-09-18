import { Navigate } from 'react-router-dom';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { OrderTrackCard } from '../components/order-track-card';
import type { CatalogProduct, OrderDetail } from '../types/api';
import { CartEmptyView } from './cart-page';
import { OrderTicketView } from './order-detail-page';
import { WalletBoardView } from './wallet-page';

function qaOrder(overrides: Partial<OrderDetail>): OrderDetail {
  return {
    id: 'qa-95',
    folio: 95,
    fecha_operativa: '2026-09-17',
    estado: 'por_cobrar',
    metodo_pago: 'efectivo',
    destino: 'para_llevar',
    espacio: null,
    subtotal: '73.70',
    ahorro_combinado: '0.00',
    cashback_otorgado: '0.00',
    total: '73.70',
    version: 1,
    creado_en: '2026-09-17T12:00:00Z',
    actualizado_en: '2026-09-17T12:00:00Z',
    notas_cocina: null,
    usuario: { nombre: 'Ana', matricula: null },
    items: [
      {
        id: 1,
        producto_id: 1,
        nombre_producto: 'Quiere keke',
        estacion_preparacion: 'cocina',
        cantidad: 1,
        precio_digital_unitario: '73.70',
        subtotal: '73.70',
        opciones: [],
      },
    ],
    pago: null,
    ...overrides,
  };
}

const CASH = qaOrder({});
const CARD = qaOrder({
  id: 'qa-94',
  folio: 94,
  estado: 'cobrado',
  metodo_pago: 'stripe',
  qr_token: 'QA94LISTO',
  pago: {
    payment_attempt_id: 'qa-attempt',
    payment_intent_id: 'pi_qa',
    stripe_account_id: 'acct_qa',
    payment_status: 'confirmado',
  },
});
const CARD_AGAIN = qaOrder({
  id: 'qa-93',
  folio: 93,
  estado: 'cobrado',
  metodo_pago: 'stripe',
  pago: {
    payment_attempt_id: 'qa-attempt-2',
    payment_intent_id: 'pi_qa_2',
    stripe_account_id: 'acct_qa',
    payment_status: 'confirmado',
  },
});
const PAST_LUPIS = qaOrder({
  id: 'qa-76',
  folio: 76,
  estado: 'entregado',
  total: '22.00',
  items: [
    {
      id: 1,
      producto_id: 2,
      nombre_producto: 'fruti Lupis',
      estacion_preparacion: 'caja',
      cantidad: 1,
      precio_digital_unitario: '22.00',
      subtotal: '22.00',
      opciones: [],
    },
  ],
});
const PAST_KEKE = qaOrder({
  id: 'qa-68',
  folio: 68,
  estado: 'entregado',
});

function qaProduct(
  id: number,
  nombre: string,
  precio: string,
  estacion: CatalogProduct['estacion_preparacion'],
): CatalogProduct {
  return {
    id,
    categoria_id: 1,
    estacion_preparacion: estacion,
    nombre,
    descripcion: null,
    ingredientes: null,
    alergenos: null,
    tiempo_estimado_min: 4,
    precio_mostrador: precio,
    precio_digital: precio,
    disponible: true,
    imagen_url: null,
    grupos_opcion: [],
  };
}

const PEEK_LUPIS = qaProduct(2, 'fruti Lupis', '22.00', 'caja');
const PEEK_KEKE = qaProduct(1, 'Quiere keke', '73.70', 'cocina');

export function AlumnoQaCartPage() {
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;
  return (
    <AppShell tab="cart">
      <main id="main-content" className="alumno-main">
        <AlumnoPageHeader kicker="Revisa y confirma" title="Tu pedido" />
        <CartEmptyView
          slug="demo-a"
          previousOrders={[PAST_LUPIS, PAST_KEKE]}
          menuPeek={[PEEK_LUPIS, PEEK_KEKE]}
        />
      </main>
    </AppShell>
  );
}

export function AlumnoQaWalletPage() {
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;
  return (
    <AppShell tab="wallet">
      <main id="main-content" className="alumno-main">
        <AlumnoPageHeader title="Cartera" />
        <WalletBoardView
          saldo="0.00"
          placeSlug="demo-a"
          reloadHref="/u/preview"
          movimientos={[]}
          menuPeek={[PEEK_LUPIS, PEEK_KEKE]}
        />
      </main>
    </AppShell>
  );
}

export function AlumnoQaOrdersPage() {
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;
  return (
    <AppShell tab="orders">
      <main id="main-content" className="alumno-main">
        <AlumnoPageHeader title="Mis pedidos" />
        <p className="alumno-place-name">Venecia</p>
        <div className="alumno-orders-desk">
          <div className="alumno-orders-desk__list">
            <section aria-labelledby="qa-orders-live">
              <h2 className="alumno-section-label alumno-section-label--live" id="qa-orders-live">
                En curso
              </h2>
              <div className="alumno-order-list">
                <OrderTrackCard order={CASH} expanded={false} onToggle={() => undefined} />
                <OrderTrackCard order={CARD} expanded onToggle={() => undefined} />
                <OrderTrackCard order={CARD_AGAIN} expanded={false} onToggle={() => undefined} />
              </div>
            </section>
          </div>
          <aside className="alumno-orders-desk__detail">
            <OrderTrackCard order={CARD} expanded toggle={false} onToggle={() => undefined} />
          </aside>
        </div>
      </main>
    </AppShell>
  );
}

export function AlumnoQaOrderDetailPage() {
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;
  return (
    <AppShell tab="orders">
      <main id="main-content" className="alumno-main">
        <AlumnoPageHeader
          kicker="Pedido"
          title={`#${CARD.folio}`}
          back={{ to: '/cuenta/pedidos', label: 'Volver' }}
        />
        <div className="alumno-detail-split">
          <OrderTrackCard
            order={CARD}
            expanded
            completeLink={false}
            toggle={false}
            onToggle={() => undefined}
          />
          <OrderTicketView order={CARD} pickupToken={CARD.qr_token ?? null} stripeOrder />
        </div>
      </main>
    </AppShell>
  );
}
