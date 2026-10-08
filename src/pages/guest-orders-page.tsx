// Pedidos del invitado: la misma pestaña que un registrado, con su llave.
// Sus pedidos activos en vivo (formato de /cuenta/pedidos), la mesa compartida del
// espacio escaneado y sus enlaces guardados. Sin Cartera: el saldo es de cuentas;
// abajo va la invitación opcional a crearla. Contrato: backend
// docs/compra-sin-cuenta.md (tercera vuelta).
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { GuestLiveOrders } from '../components/guest-live-orders';
import { GuestOrderSaveLink } from '../components/guest-order-save-link';
import { SharedTableCard } from '../components/shared-table-card';
import { SessionOrdersCard } from '../components/session-orders';
import { WaitingArcade } from '../arcade/waiting-arcade';
import { LoadingSkeleton } from '../components/loading-skeleton';
import { useCart } from '../context/cart-context';
import { api } from '../lib/api';
import { catalogImageMap, orderThumbUrl } from '../lib/catalog-images';
import { readGuest } from '../lib/guest-session';
import { lastPlaceSlug } from '../lib/last-place';
import { formatAmount } from '../lib/money';
import { openTab } from '../lib/order-labels';
import { readSpace, rememberSpace } from '../lib/space-session';
import { clearClosedTableSession, observeTableSession } from '../lib/table-session-cleanup';
import { groupOrdersBySession } from '../lib/session-orders';
import { useGuestLiveOrders } from '../lib/use-guest-live-orders';
import { useGuestSpaceToken } from '../lib/use-guest-space-token';
import { usePwaInstall } from '../lib/pwa-install';
import type { CatalogProduct, LegalVersions, PublicEstablishment, SharedTable } from '../types/api';

export function GuestOrdersPage() {
  const { cart } = useCart();
  const [search] = useSearchParams();
  // Recién pedido: el carrito llega con ?nuevo=<token> y ese pedido ya se ve abierto.
  const nuevoToken = search.get('nuevo');
  const slug = cart?.slug ?? lastPlaceSlug();
  const [place, setPlace] = useState<PublicEstablishment | null>(null);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [legal, setLegal] = useState<LegalVersions | null>(null);
  const [activeTable, setActiveTable] = useState<SharedTable | null>(null);
  const [tableChecked, setTableChecked] = useState(false);
  const live = useGuestLiveOrders(slug ?? '');
  const mesa = useGuestSpaceToken(slug);
  const guestName = readGuest()?.nombre ?? '';
  const qrToken = slug ? (readSpace(slug)?.qrToken ?? null) : null;
  const thumbImages = useMemo(() => catalogImageMap(catalogProducts), [catalogProducts]);
  const liveSessionGroups = useMemo(
    () => groupOrdersBySession(live.orders).filter((group) => group.sessionId !== activeTable?.sesion_id),
    [activeTable?.sesion_id, live.orders],
  );
  const liveIndividualOrders = useMemo(
    () => live.orders.filter((order) => !order.sesion_espacio_id),
    [live.orders],
  );
  const tab = openTab(live.orders);
  const pwa = usePwaInstall();
  const justOrdered = nuevoToken !== null;

  useEffect(() => {
    if (!slug) return;
    let active = true;
    void Promise.all([
      api.getEstablishment(slug).catch(() => null),
      api.getGuestCatalog(slug).catch(() => ({ productos: [] as CatalogProduct[] })),
      api.getLegalVersions().catch(() => null),
    ]).then(([nextPlace, catalog, nextLegal]) => {
      if (!active) return;
      if (nextPlace) setPlace(nextPlace);
      setCatalogProducts(Array.isArray(catalog?.productos) ? catalog.productos : []);
      setLegal(nextLegal);
    });
    return () => {
      active = false;
    };
  }, [slug]);

  // Al cerrar y reabrir la pestaña, la mesa sigue abierta en el servidor: se
  // restaura el espacio para que el pedido se ligue igual (el QR ya no está).
  useEffect(() => {
    if (!slug || !mesa.token || readSpace(slug)) return;
    let active = true;
    void api
      .currentTable(mesa.token)
      .then((table) => {
        if (!active) return;
        if (!table) {
          clearClosedTableSession(slug, readSpace(slug)?.espacioId);
          return;
        }
        observeTableSession(table.sesion_id, {
          slug,
          espacioId: table.espacio.id,
          nombre: table.espacio.nombre,
          tipo: table.espacio.tipo,
        });
        rememberSpace({
          slug,
          espacioId: table.espacio.id,
          nombre: table.espacio.nombre,
          tipo: table.espacio.tipo,
          sesionId: table.sesion_id,
        });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [mesa.token, slug]);

  if (!slug) {
    return (
      <AppShell tab="orders">
        <main id="main-content" className="alumno-main">
          <AlumnoPageHeader title="Pedidos" />
          <div className="alumno-empty">
            <img src="/vaini/cutout-frente.png" alt="" />
            <p>Aún no hay pedidos en esta sesión.</p>
            <Link className="alumno-btn alumno-btn--lime" to="/pedir">
              Elegir lugar
            </Link>
          </div>
          <GuestAccountInvite />
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell tab="orders">
      <main id="main-content" className="alumno-main">
        <AlumnoPageHeader title="Mis pedidos" />
        {place?.nombre ? <p className="alumno-place-name">{place.nombre}</p> : null}
        {live.error ? <p className="alumno-error">{live.error}</p> : null}
        <SharedTableCard
          accessToken={mesa.token}
          slug={slug}
          qrToken={qrToken}
          onTableChange={(next) => { setActiveTable(next); setTableChecked(true); }}
          defaultAlias={guestName || undefined}
          legalNote={
            legal ? (
              <p className="alumno-muted alumno-guest-checkout__legal">
                Al unirte aceptas los{' '}
                <a href={legal.terminos_url} target="_blank" rel="noreferrer">
                  Términos
                </a>{' '}
                y el{' '}
                <a href={legal.privacidad_url} target="_blank" rel="noreferrer">
                  Aviso de privacidad
                </a>
                .
              </p>
            ) : undefined
          }
          onEnsureToken={(alias) => mesa.ensure(alias)}
          onUnauthorized={() => {
            void mesa.ensure().catch(() => undefined);
          }}
        />
        {tab && !live.orders.some((order) => order.sesion_espacio_id === activeTable?.sesion_id) ? (
          <section className="alumno-tab" aria-label="Tu cuenta">
            <div>
              <strong>Tu cuenta</strong>
              <span>
                {tab.count === 1 ? '1 pedido' : `${tab.count} pedidos`} por pagar al final. Pide la
                cuenta a tu mesero.
              </span>
            </div>
            <span className="alumno-tab__total">{tab.total === null ? 'Saldo no disponible' : formatAmount(tab.total)}</span>
          </section>
        ) : null}
        {live.orders.length === 0 && live.loading ? (
          <LoadingSkeleton shape="orders" label="Cargando pedidos…" />
        ) : live.orders.length === 0 && (activeTable?.grupos.some((group) => group.pedidos.length > 0) || !tableChecked) ? null : live.orders.length === 0 ? (
          <div className="alumno-empty">
            <img src="/vaini/cutout-frente.png" alt="" />
            <p>Aún no hay pedidos en esta sesión.</p>
            <Link className="alumno-btn alumno-btn--lime" to={`/e/${slug}`}>
              Ver menú
            </Link>
          </div>
        ) : (
          <>
            <GuestLiveOrders
              orders={liveIndividualOrders}
              imageFor={(order) => orderThumbUrl(order, thumbImages, catalogProducts)}
              initialExpandedToken={nuevoToken}
            />
            {liveSessionGroups.map((group) => (
              <SessionOrdersCard
                key={group.sessionId}
                group={group}
                initialExpanded={group.orders.some((order) => order.seguimiento_token === nuevoToken)}
              />
            ))}
            {liveIndividualOrders
              .filter((order) => typeof order.seguimiento_token === 'string')
              .map((order) => (
                <GuestOrderSaveLink
                  key={order.id}
                  token={order.seguimiento_token as string}
                  folio={order.folio}
                />
              ))}
            <WaitingArcade />
          </>
        )}
        {pwa.offer && justOrdered ? (
          <section className="alumno-banner" aria-label="Instalar Vaiinilla">
            <p>
              <strong>¿Instalas Vaiinilla?</strong> Tus pedidos sin cuenta siguen aquí
              sin guardar enlaces, directo desde tu pantalla de inicio.
            </p>
            <div className="alumno-tracking__actions">
              <button
                className="alumno-btn alumno-btn--lime"
                type="button"
                onClick={() => void pwa.install()}
              >
                Instalar
              </button>
              <button className="alumno-btn" type="button" onClick={pwa.dismiss}>
                Ahora no
              </button>
            </div>
          </section>
        ) : null}
        <GuestAccountInvite name={guestName || undefined} />
      </main>
    </AppShell>
  );
}

function GuestAccountInvite({ name }: { name?: string }) {
  return (
    <p className="alumno-muted alumno-tracking__account">
      {name ? `Pides como ${name} sin cuenta. ` : 'Pides sin cuenta. '}
      ¿Quieres saldo e historial? <Link to="/cuenta">Crea tu cuenta</Link> (opcional).
    </p>
  );
}
