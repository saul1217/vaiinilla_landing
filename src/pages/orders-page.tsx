import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlumnoPageHeader } from "../components/alumno-brand";
import { AppShell } from "../components/app-shell";
import { OrderTrackCard } from "../components/order-track-card";
import { SharedTableCard } from "../components/shared-table-card";
import { readSpace } from "../lib/space-session";
import { WaitingArcade } from "../arcade/waiting-arcade";
import { useAuth } from "../context/auth-context";
import { useBuyerSession } from "../context/buyer-session";
import { useCart } from "../context/cart-context";
import { api } from "../lib/api";
import { resolveClientSession } from "../lib/client-session";
import { lastPlaceSlug } from "../lib/last-place";
import { errorMessage, VaiinillaApiError } from "../lib/api-error";
import { catalogImageMap, orderThumbUrl } from "../lib/catalog-images";
import { formatAmount } from "../lib/money";
import { persistPickupQrFromOrder } from "../lib/pickup-qr";
import { isActiveOrder, openTab } from "../lib/order-labels";
import { readGuestOrders } from "../lib/guest-orders";
import { forgetGuest } from "../lib/guest-session";
import { claimGuestOrders, hasClaimableGuestOrders } from "../lib/guest-claim";
import { usePwaInstall } from "../lib/pwa-install";
import { usePickupQrToken } from "../lib/use-pickup-qr";
import { useDeskPane } from "../lib/use-desk-pane";
import type {
  CatalogProduct,
  OrderDetail,
  PublicEstablishment,
} from "../types/api";
import { LoadingSkeleton } from "../components/loading-skeleton";
import { peekResource, resourceKeys, storeResource } from "../lib/resource-cache";
import { GuestOrdersPage } from "./guest-orders-page";

const POLL_MS = 5000;

export function OrdersPage() {
  const { user, ready } = useAuth();
  const { cart } = useCart();
  const { context, openClientSession } = useBuyerSession();
  // Al volver a esta pestaña se ven al instante los últimos pedidos de esta cuenta en
  // este negocio; la consulta de cada 5 s los actualiza en segundo plano.
  const placeGuess = cart?.slug ?? lastPlaceSlug();
  const ordersKey = user && placeGuess ? resourceKeys.orders(user.uid, placeGuess) : null;
  const [orders, setOrders] = useState<OrderDetail[]>(() => (ordersKey && peekResource<OrderDetail[]>(ordersKey)) || []);
  const [error, setError] = useState<string | null>(null);
  const [place, setPlace] = useState<PublicEstablishment | null>(
    () => (placeGuess && peekResource<PublicEstablishment>(resourceKeys.establishment(placeGuess))) || null,
  );
  const [loading, setLoading] = useState(() => !(ordersKey && peekResource(ordersKey)));
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // Recién pedido: el carrito llega con ?nuevo=<id> y ese pedido ya se ve abierto.
  const [expandedId, setExpandedId] = useState<string | null>(() => searchParams.get("nuevo"));
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  // Reclamo invitado → cuenta: tras pasarlos se vuelve a consultar para verlos aquí.
  const [claimKey, setClaimKey] = useState(0);
  const [claim, setClaim] = useState<{
    state: "idle" | "busy" | "done" | "error";
    pedidos?: number;
    detail?: string;
  }>({ state: "idle" });
  const deskPane = useDeskPane();
  const deskAutoSelected = useRef(false);
  // Instalación en contexto: recién pedido, seguir sin guardar enlaces tiene sentido.
  // Junto a los demás hooks: antes del retorno de invitado.
  const pwa = usePwaInstall();
  const thumbImages = catalogImageMap(catalogProducts);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }
    let active = true;
    const run = async (silent = false) => {
      try {
        const resolved = await resolveClientSession({
          user,
          context,
          preferredSlug: cart?.slug ?? lastPlaceSlug(),
          openClientSession,
        });
        if (!resolved) {
          if (active && !silent) {
            setError(
              "Entra a un establecimiento para ver tus pedidos de ese lugar.",
            );
            setLoading(false);
          }
          return;
        }
        if (resolved.place && active) setPlace(resolved.place);
        if (resolved.slug) {
          void api
            .getGuestCatalog(resolved.slug)
            .then((catalog) => {
              if (active) setCatalogProducts(catalog.productos);
            })
            .catch(() => undefined);
        }
        const result = await api.listOrders(resolved.context.access_token);
        if (!active) return;
        result.orders.forEach((item) => persistPickupQrFromOrder(item));
        if (resolved.slug) storeResource(resourceKeys.orders(user.uid, resolved.slug), result.orders);
        setOrders(result.orders);
        setError(null);
      } catch (cause) {
        // Alta a medias: /cuenta retoma el paso de términos (igual que el carrito).
        if (cause instanceof VaiinillaApiError && cause.code === "IDENTITY_NOT_REGISTERED") {
          if (active) void navigate("/cuenta?next=/cuenta/pedidos");
          return;
        }
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
  }, [cart?.slug, claimKey, context, navigate, openClientSession, ready, user]);

  useEffect(() => {
    if (!deskPane) {
      deskAutoSelected.current = false;
      return;
    }
    if (deskAutoSelected.current || expandedId || orders.length === 0) return;
    deskAutoSelected.current = true;
    const firstActive = orders.find((item) => isActiveOrder(item));
    setExpandedId(firstActive?.id ?? orders[0]?.id ?? null);
  }, [deskPane, expandedId, orders]);

  const selected = orders.find((order) => order.id === expandedId) ?? null;
  const pickupToken = usePickupQrToken(selected, context?.access_token ?? null);

  if (ready && !user) return <GuestOrdersPage />;

  const activeOrders = orders.filter((order) => isActiveOrder(order));
  const pastOrders = orders.filter((order) => !isActiveOrder(order));
  const tab = openTab(orders);

  function toggle(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  // "Estos pedidos eran míos": lo que se pidió sin cuenta en este navegador se
  // muda a la cuenta (el alta recién hecha ya lo intentó en silencio).
  async function claimNow() {
    if (!user || claim.state === "busy") return;
    setClaim({ state: "busy" });
    try {
      const out = await claimGuestOrders(user);
      if (!out) {
        setClaim({ state: "idle" });
        return;
      }
      setClaim({ state: "done", pedidos: out.reclamado.pedidos });
      setClaimKey((current) => current + 1);
    } catch (cause) {
      if (cause instanceof VaiinillaApiError && cause.code === "GUEST_KEY_INVALID") {
        forgetGuest();
        setClaim({ state: "idle" });
        return;
      }
      setClaim({ state: "error", detail: errorMessage(cause) });
    }
  }

  const claimableCount = user ? readGuestOrders().length : 0;
  const justOrdered = searchParams.get("nuevo") !== null;

  return (
    <AppShell tab="orders">
      <main id="main-content" className="alumno-main">
        <AlumnoPageHeader title="Mis pedidos" />
        {place?.nombre ? (
          <p className="alumno-place-name">{place.nombre}</p>
        ) : null}
        {error ? <p className="alumno-error">{error}</p> : null}
        {user && claim.state === "idle" && hasClaimableGuestOrders() ? (
          <section className="alumno-banner" aria-label="Pasar pedidos de invitado a tu cuenta">
            <p>
              <strong>Pediste sin cuenta en este navegador.</strong> Pásalos a tu
              cuenta para verlos aquí siempre, en este y otros dispositivos.
            </p>
            <div className="alumno-tracking__actions">
              <button
                className="alumno-btn alumno-btn--lime"
                type="button"
                onClick={() => void claimNow()}
              >
                {claimableCount === 1
                  ? "Pasar mi pedido a mi cuenta"
                  : `Pasar mis ${claimableCount} pedidos a mi cuenta`}
              </button>
            </div>
          </section>
        ) : null}
        {claim.state === "busy" ? <p role="status">Pasando tus pedidos…</p> : null}
        {claim.state === "done" ? (
          <p className="alumno-banner" role="status">
            {claim.pedidos === 0
              ? "Listo: esos pedidos ya estaban en tu cuenta."
              : `Listo: ${claim.pedidos === 1 ? "tu pedido ya está" : `tus ${claim.pedidos} pedidos ya están`} en tu cuenta.`}
          </p>
        ) : null}
        {claim.state === "error" ? <p className="alumno-error">{claim.detail}</p> : null}
        {pwa.offer && justOrdered ? (
          <section className="alumno-banner" aria-label="Instalar Vaiinilla">
            <p>
              <strong>¿Instalas Vaiinilla?</strong> Sigue tus pedidos sin guardar
              enlaces, directo desde tu pantalla de inicio.
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
        <SharedTableCard
          accessToken={context?.access_token ?? null}
          qrToken={readSpace(place?.slug ?? placeGuess ?? "")?.qrToken ?? null}
        />
        {tab ? (
          <section className="alumno-tab" aria-label="Tu cuenta">
            <div>
              <strong>Tu cuenta</strong>
              <span>
                {tab.count === 1 ? "1 pedido" : `${tab.count} pedidos`} por pagar al final. Pide la cuenta a tu mesero.
              </span>
            </div>
            <span className="alumno-tab__total">{formatAmount(tab.total)}</span>
          </section>
        ) : null}
        {loading && orders.length === 0 && !error ? (
          <LoadingSkeleton shape="orders" label="Cargando pedidos…" />
        ) : null}
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
                  <h2
                    className="alumno-section-label alumno-section-label--live"
                    id="orders-live"
                  >
                    En curso
                  </h2>
                  <div className="alumno-order-list alumno-arrive">
                    {activeOrders.map((order) => (
                      <OrderTrackCard
                        key={order.id}
                        order={order}
                        expanded={!deskPane && expandedId === order.id}
                        selected={deskPane && expandedId === order.id}
                        onToggle={() => toggle(order.id)}
                        callWaiter={!(deskPane && expandedId === order.id)}
                        imageUrl={orderThumbUrl(
                          order,
                          thumbImages,
                          catalogProducts,
                        )}
                        pickupToken={
                          !deskPane && expandedId === order.id
                            ? pickupToken
                            : null
                        }
                      />
                    ))}
                  </div>
                  <WaitingArcade />
                </section>
              ) : null}
              {pastOrders.length > 0 ? (
                <section aria-labelledby="orders-past">
                  <h2 className="alumno-section-label" id="orders-past">
                    Anteriores
                  </h2>
                  <div className="alumno-order-list alumno-arrive">
                    {pastOrders.map((order) => (
                      <OrderTrackCard
                        key={order.id}
                        order={order}
                        expanded={!deskPane && expandedId === order.id}
                        selected={deskPane && expandedId === order.id}
                        onToggle={() => toggle(order.id)}
                        imageUrl={orderThumbUrl(
                          order,
                          thumbImages,
                          catalogProducts,
                        )}
                        pickupToken={
                          !deskPane && expandedId === order.id
                            ? pickupToken
                            : null
                        }
                      />
                    ))}
                  </div>
                </section>
              ) : null}
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
                      completeLink
                      toggle={false}
                      onToggle={() => undefined}
                      imageUrl={orderThumbUrl(
                        selected,
                        thumbImages,
                        catalogProducts,
                      )}
                      pickupToken={pickupToken}
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
        )}
      </main>
    </AppShell>
  );
}
