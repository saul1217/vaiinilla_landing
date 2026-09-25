import { useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { OrderTrackCard } from '../components/order-track-card';
import { WaitingArcade } from '../arcade/waiting-arcade';
import { catalogImageMap, orderThumbUrl } from '../lib/catalog-images';
import { cartPreview, linePreview } from '../lib/money';
import { QA_CATALOG_SLUG, QA_PHOTO_POZOLE, QA_PHOTO_TACOS } from '../lib/qa-catalog-photos';
import type { CartLine, CatalogProduct, OrderDetail } from '../types/api';
import { CartEmptyView, CartFilledView } from './cart-page';
import { OrderTicketView } from './order-detail-page';
import { useDeskPane } from './orders-page';
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
  pago: {
    payment_attempt_id: 'qa-attempt',
    payment_intent_id: 'pi_qa',
    stripe_account_id: 'acct_qa',
    payment_status: 'confirmado',
  },
});
const CARD_LISTO = qaOrder({
  id: 'qa-93',
  folio: 93,
  estado: 'listo',
  metodo_pago: 'stripe',
  qr_token: 'QA94LISTO',
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
  imagenUrl: string | null,
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
    imagen_url: imagenUrl,
    grupos_opcion: [],
  };
}

const PEEK_LUPIS = qaProduct(2, 'fruti Lupis', '22.00', 'caja', QA_PHOTO_POZOLE);
const PEEK_KEKE = qaProduct(1, 'Quiere keke', '73.70', 'cocina', QA_PHOTO_TACOS);
const QA_CATALOG = [PEEK_LUPIS, PEEK_KEKE];
const QA_IMAGES = catalogImageMap(QA_CATALOG);

function qaOrderThumb(order: OrderDetail) {
  return orderThumbUrl(order, QA_IMAGES, QA_CATALOG);
}

export function AlumnoQaCartPage() {
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;
  return (
    <AppShell tab="cart">
      <main id="main-content" className="alumno-main">
        <AlumnoPageHeader kicker="Revisa y confirma" title="Tu pedido" />
        <CartEmptyView
          slug={QA_CATALOG_SLUG}
          previousOrders={[PAST_LUPIS, PAST_KEKE]}
          menuPeek={[PEEK_LUPIS, PEEK_KEKE]}
        />
      </main>
    </AppShell>
  );
}

const FILL_LUPIS: CartLine = {
  productId: 2,
  quantity: 2,
  optionIds: [],
  productName: 'fruti Lupis',
  unitPreview: '22.00',
  imageUrl: QA_PHOTO_POZOLE,
};

const FILL_KEKE: CartLine = {
  productId: 1,
  quantity: 1,
  optionIds: [],
  productName: 'Quiere keke',
  unitPreview: '73.70',
  imageUrl: QA_PHOTO_TACOS,
};

export function AlumnoQaFilledCartPage() {
  const [params] = useSearchParams();
  const leftoverEmpty = params.get('leftover') === '0';
  const [lines, setLines] = useState<CartLine[]>([FILL_LUPIS, FILL_KEKE]);
  const total = useMemo(() => {
    const totals = lines
      .map((line) => linePreview(line.unitPreview, line.quantity))
      .filter((value): value is string => Boolean(value));
    return cartPreview(totals);
  }, [lines]);
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;
  return (
    <AppShell tab="cart">
      <main id="main-content" className="alumno-main">
        <AlumnoPageHeader kicker="Revisa y confirma" title="Tu pedido" />
        <CartFilledView
          lines={lines}
          onUpdateQuantity={(productId, optionIds, quantity) => {
            setLines((current) =>
              current
                .map((line) =>
                  line.productId === productId && line.optionIds.join(',') === optionIds.join(',')
                    ? { ...line, quantity }
                    : line,
                )
                .filter((line) => line.quantity > 0),
            );
          }}
          onRemoveLine={(productId, optionIds) => {
            setLines((current) =>
              current.filter(
                (line) =>
                  !(line.productId === productId && line.optionIds.join(',') === optionIds.join(',')),
              ),
            );
          }}
          forHere={false}
          space={null}
          onToggleDestination={() => undefined}
          place={null}
          clientId=""
          onClientIdChange={() => undefined}
          notes=""
          onNotesChange={() => undefined}
          total={total}
          slug={QA_CATALOG_SLUG}
          menuPeek={leftoverEmpty ? [] : QA_CATALOG}
          payLabel="Pagar"
          payDisabled={false}
          onPay={() => undefined}
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
          placeSlug={QA_CATALOG_SLUG}
          reloadHref="/u/preview"
          movimientos={[]}
          menuPeek={[PEEK_LUPIS, PEEK_KEKE]}
        />
      </main>
    </AppShell>
  );
}

export function AlumnoQaOrdersPage() {
  const deskPane = useDeskPane();
  const [expandedId, setExpandedId] = useState<string | null>(CARD.id);
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;
  const live = [CASH, CARD, CARD_LISTO];
  const selected = live.find((order) => order.id === expandedId) ?? null;
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
                {live.map((order) => {
                  const open = !deskPane && expandedId === order.id;
                  return (
                    <OrderTrackCard
                      key={order.id}
                      order={order}
                      expanded={open}
                      selected={deskPane && expandedId === order.id}
                      onToggle={() => {
                        setExpandedId((current) => (current === order.id ? null : order.id));
                      }}
                      imageUrl={qaOrderThumb(order)}
                      pickupToken={open ? order.qr_token ?? null : null}
                    />
                  );
                })}
              </div>
              <WaitingArcade />
            </section>
          </div>
          {deskPane ? (
            <aside className="alumno-orders-desk__detail">
              {selected ? (
                <>
                  <button
                    className="alumno-orders-desk__hide"
                    type="button"
                    onClick={() => setExpandedId(null)}
                  >
                    Ocultar
                  </button>
                  <OrderTrackCard
                    order={selected}
                    expanded
                    toggle={false}
                    onToggle={() => undefined}
                    imageUrl={qaOrderThumb(selected)}
                    pickupToken={selected.qr_token ?? null}
                  />
                </>
              ) : (
                <div className="alumno-orders-desk__hint">
                  <img src="/vaini/cutout-frente.png" alt="" />
                  <p>Elige un pedido para ver el seguimiento.</p>
                </div>
              )}
            </aside>
          ) : null}
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
          title={`#${CARD_LISTO.folio}`}
          back={{ to: '/cuenta/pedidos', label: 'Volver' }}
        />
        <div className="alumno-detail-split">
          <OrderTrackCard
            order={CARD_LISTO}
            expanded
            completeLink={false}
            toggle={false}
            onToggle={() => undefined}
            imageUrl={qaOrderThumb(CARD_LISTO)}
            pickupToken={CARD_LISTO.qr_token ?? null}
          />
          <OrderTicketView order={CARD_LISTO} />
        </div>
      </main>
    </AppShell>
  );
}
