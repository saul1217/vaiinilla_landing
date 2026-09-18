import { Navigate } from 'react-router-dom';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { OrderTrackCard } from '../components/order-track-card';
import type { OrderDetail } from '../types/api';
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
});

export function AlumnoQaWalletPage() {
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;
  return (
    <AppShell tab="wallet">
      <main id="main-content" className="alumno-main">
        <AlumnoPageHeader title="Cartera" />
        <WalletBoardView saldo="0.00" placeSlug="demo-a" reloadHref="/u/preview" movimientos={[]} />
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
              </div>
            </section>
          </div>
          <aside className="alumno-orders-desk__detail">
            <OrderTrackCard order={CARD} expanded onToggle={() => undefined} />
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
