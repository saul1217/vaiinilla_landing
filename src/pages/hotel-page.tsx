// El huésped de hotel en la web: código de estancia, bienvenida (H01), pedido al cuarto (H03),
// solicitudes (H05) y su cuenta con la salida (H06). Espejo de `ui/hotel/guest` (Android). El menú y
// el carrito son los de siempre; al confirmar, una habitación usa su propio pedido (cargo a la cuenta).
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { LoadingSkeleton } from '../components/loading-skeleton';
import { useAuth } from '../context/auth-context';
import { useBuyerSession } from '../context/buyer-session';
import { useCart } from '../context/cart-context';
import { api } from '../lib/api';
import { VaiinillaApiError, errorMessage } from '../lib/api-error';
import { cartTotal, toCreateOrderInput } from '../lib/cart';
import { clientSessionForPlace } from '../lib/client-session-for-place';
import { rememberGuestOrder, trackingPath } from '../lib/guest-orders';
import {
  DEFAULT_HOTEL_CONFIG,
  REQUEST_LABEL,
  REQUEST_OPTIONS,
  REQUEST_STATUS_LABEL,
  STAY_CODE_LENGTH,
  accountHeadline,
  accountLines,
  firstName,
  hotelErrorMessage,
  isClosedStay,
  isOpenRequest,
  lateCheckoutNote,
  moneyLabel,
  shortDate,
  stayCost,
  stayRange,
  tapRequest,
  type HotelConfig,
  type HotelRequest,
  type RequestType,
  type Stay,
} from '../lib/hotel';
import { createHotelClient, type HotelClient } from '../lib/hotel-client';
import { hotelPath, type HotelView } from '../lib/hotel-routes';
import { createIdempotencyKey, forgetIdempotencyKey, idempotencyKeyFor, orderFingerprint } from '../lib/idempotency';
import { linePreview } from '../lib/money';
import { readSpace, type SpaceSession } from '../lib/space-session';
import { rememberStripeCheckoutSession, stripeSessionFromCreatedOrder } from '../lib/stripe-session';
import { isAwaitingAcceptance } from '../lib/stripe-status';
import { isStripeCheckoutEnabled, offersCardPayment } from '../lib/stripe-public';
import type { OrderDetail, PaymentMethod, PublicEstablishment } from '../types/api';

const VIEWS: readonly HotelView[] = ['codigo', 'solicitudes', 'cuenta', 'pedido'];

/** `/e/:slug/carrito`: en una habitación el pedido se confirma en la pantalla del hotel (H03). */
export function CartRoute({ children }: { children: ReactNode }) {
  const { slug = '' } = useParams();
  if (readSpace(slug)?.esHabitacion) return <Navigate to={hotelPath(slug, 'pedido')} replace />;
  return <>{children}</>;
}

export function HotelPage() {
  const { slug = '', view: rawView } = useParams();
  const view = VIEWS.includes(rawView as HotelView) ? (rawView as HotelView) : undefined;
  const navigate = useNavigate();
  const { user, ready } = useAuth();
  const { context, openClientSession } = useBuyerSession();
  const [place, setPlace] = useState<PublicEstablishment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const session = useRef({ user, context, openClientSession });
  session.current = { user, context, openClientSession };

  useEffect(() => {
    let active = true;
    void api
      .getEstablishment(slug)
      .then((next) => {
        if (active) setPlace(next);
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [slug]);

  // La sesión se pide en cada llamada: la de invitado dura 15 minutos y se renueva sola con la llave.
  const client = useMemo(
    () =>
      ready
        ? createHotelClient(async () => {
            const current = session.current;
            const resolved = await clientSessionForPlace({
              slug,
              user: current.user,
              context: current.context,
              openClientSession: current.openClientSession,
            });
            return resolved.access_token;
          })
        : null,
    // Cambiar de cuenta (entrar o salir) es otra persona: otra estancia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, slug, user?.uid],
  );

  const afterOrder = useCallback(
    (order: OrderDetail, method: PaymentMethod) => {
      if (method === 'stripe' && !isAwaitingAcceptance(order)) {
        rememberStripeCheckoutSession(order.id, stripeSessionFromCreatedOrder(order));
      }
      if (!user && order.seguimiento_token) {
        rememberGuestOrder({
          token: order.seguimiento_token,
          slug,
          folio: order.folio,
          placeName: place?.nombre ?? '',
          createdAt: Date.now(),
        });
        void navigate(
          method === 'stripe'
            ? `${trackingPath(order.seguimiento_token)}?nuevo=1`
            : `/cuenta/pedidos?nuevo=${order.seguimiento_token}`,
        );
        return;
      }
      void navigate(method === 'stripe' ? `/cuenta/pedidos/${order.id}` : `/cuenta/pedidos?nuevo=${order.id}`);
    },
    [navigate, place?.nombre, slug, user],
  );

  return (
    <AppShell tab="menu">
      <main id="main-content" className="alumno-main hotel-main">
        {error ? <p className="alumno-error">{error}</p> : null}
        {client ? (
          <HotelScreen
            key={user?.uid ?? 'invitado'}
            client={client}
            slug={slug}
            view={view}
            venueName={place?.nombre ?? null}
            cardOffered={offersCardPayment(place) && isStripeCheckoutEnabled()}
            room={readSpace(slug)}
            afterOrder={afterOrder}
          />
        ) : (
          <LoadingSkeleton shape="rows" label="Cargando tu estancia…" />
        )}
      </main>
    </AppShell>
  );
}

interface HotelScreenProps {
  client: HotelClient;
  slug: string;
  view: HotelView | undefined;
  venueName: string | null;
  /** El negocio cobra con tarjeta en la web; además el hotel debe tener «tarjeta al pedir». */
  cardOffered: boolean;
  /** La habitación del QR escaneado; sin ella el código no se puede ligar. */
  room: SpaceSession | null;
  afterOrder: (order: OrderDetail, method: PaymentMethod) => void;
}

/** El flujo completo sin red ni router propio: se prueba con un cliente falso. */
export function HotelScreen({ client, slug, view, venueName, cardOffered, room, afterOrder }: HotelScreenProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stay, setStay] = useState<Stay | null>(null);
  const [config, setConfig] = useState<HotelConfig>(DEFAULT_HOTEL_CONFIG);
  const [error, setError] = useState<string | null>(null);
  const roomId = room?.esHabitacion ? room.espacioId : null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const mine = await client.myStay(roomId);
      setStay(mine);
      const settings = mine?.settings ?? (await client.config().catch(() => null));
      if (settings) setConfig(settings);
    } catch (cause) {
      setError(hotelErrorMessage(cause, 'No pudimos cargar tu estancia.'));
    } finally {
      setLoading(false);
    }
  }, [client, roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  const home = hotelPath(slug);

  if (loading) return <LoadingSkeleton shape="rows" label="Cargando tu estancia…" />;

  if (error && !stay) {
    return (
      <>
        <AlumnoPageHeader kicker="Tu habitación" title="No pudimos abrir tu estancia" />
        <p className="alumno-error" role="alert">
          {error}
        </p>
        <button type="button" className="alumno-btn alumno-btn--lime hotel-tap" onClick={() => void load()}>
          Reintentar
        </button>
      </>
    );
  }

  if (!stay || view === 'codigo') {
    return (
      <HotelStayCode
        client={client}
        room={room}
        onLinked={(linked) => {
          setStay(linked);
          if (linked.settings) setConfig(linked.settings);
          void navigate(home, { replace: true });
        }}
      />
    );
  }

  if (view === 'solicitudes') {
    return (
      <HotelRequests
        client={client}
        stay={stay}
        config={config}
        home={home}
        onStayChange={setStay}
      />
    );
  }

  if (view === 'cuenta') return <HotelAccount stay={stay} config={config} home={home} slug={slug} />;

  if (view === 'pedido') {
    return (
      <HotelCheckout
        client={client}
        slug={slug}
        stay={stay}
        config={config}
        cardOffered={cardOffered}
        roomId={stay.roomId ?? roomId}
        home={home}
        afterOrder={afterOrder}
        onStayLost={() => {
          setStay(null);
          void navigate(hotelPath(slug, 'codigo'));
        }}
      />
    );
  }

  return <HotelWelcome slug={slug} stay={stay} config={config} venueName={venueName} />;
}

// region Código de estancia

function HotelStayCode({
  client,
  room,
  onLinked,
}: {
  client: HotelClient;
  room: SpaceSession | null;
  onLinked: (stay: Stay) => void;
}) {
  const [code, setCode] = useState('');
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const complete = code.length === STAY_CODE_LENGTH;
  const hasRoom = Boolean(room?.esHabitacion);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!complete || linking || !room) return;
    setLinking(true);
    setError(null);
    try {
      onLinked(await client.linkStay(code, { qrToken: room.qrToken, roomId: room.espacioId }));
    } catch (cause) {
      setError(hotelErrorMessage(cause));
    } finally {
      setLinking(false);
    }
  }

  return (
    <form className="hotel-code" onSubmit={(event) => void submit(event)} noValidate>
      <AlumnoPageHeader
        kicker={room?.nombre ?? 'Tu habitación'}
        title="Escribe tu código de estancia"
        lead={`Recepción te lo dio al registrarte. Son ${STAY_CODE_LENGTH} números.`}
      />
      {hasRoom ? (
        <>
          <div className="hotel-code__boxes">
            <div className={error ? 'hotel-code__row has-error' : 'hotel-code__row'} aria-hidden="true">
              {Array.from({ length: STAY_CODE_LENGTH }, (_, index) => (
                <span key={index} className={index === code.length ? 'is-active' : undefined}>
                  {code[index] ?? ''}
                </span>
              ))}
            </div>
            <input
              className="hotel-code__input"
              aria-label="Código de estancia"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={STAY_CODE_LENGTH}
              autoFocus
              disabled={linking}
              value={code}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'hotel-code-error' : undefined}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, '').slice(0, STAY_CODE_LENGTH);
                if (digits !== code) {
                  setCode(digits);
                  setError(null);
                }
              }}
            />
          </div>
          {error ? (
            <p id="hotel-code-error" className="alumno-error" role="alert">
              {error}
            </p>
          ) : null}
          <p className="alumno-muted">¿No lo tienes? Pídelo en recepción.</p>
          <button
            type="submit"
            className={linking ? 'alumno-btn alumno-btn--lime hotel-tap is-working' : 'alumno-btn alumno-btn--lime hotel-tap'}
            disabled={!complete || linking}
          >
            {linking ? 'Entrando…' : 'Entrar a mi habitación'}
          </button>
        </>
      ) : (
        <>
          <p className="alumno-muted">Escanea el QR de la puerta de tu habitación para escribir tu código.</p>
          <Link className="alumno-btn alumno-btn--lime hotel-tap" to="/pedir">
            Escanear el QR
          </Link>
        </>
      )}
    </form>
  );
}

// endregion

// region Bienvenida (H01)

function HotelWelcome({
  slug,
  stay,
  config,
  venueName,
}: {
  slug: string;
  stay: Stay;
  config: HotelConfig;
  venueName: string | null;
}) {
  const range = stayRange(stay.checkIn, stay.checkOut);
  const details = [
    range ? `Estancia ${range}` : null,
    stay.floor != null ? `Piso ${stay.floor}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const tiles: Array<{ to: string; title: string; subtitle: string; testId: string }> = [
    { to: `/e/${slug}`, title: 'Room service', subtitle: 'Desayuno, cena y bebidas', testId: 'room-service' },
  ];
  if (config.requestsEnabled) {
    tiles.push({ to: hotelPath(slug, 'solicitudes'), title: 'Limpieza', subtitle: 'Toallas, amenidades', testId: 'limpieza' });
    if (config.lateCheckoutTime) {
      tiles.push({ to: hotelPath(slug, 'solicitudes'), title: 'Salida tardía', subtitle: 'Pide más tiempo', testId: 'salida-tardia' });
    }
  }
  tiles.push({ to: hotelPath(slug, 'cuenta'), title: 'Mi cuenta', subtitle: 'Cargos y salida', testId: 'cuenta' });

  return (
    <section className="hotel-welcome" aria-labelledby="hotel-welcome-title">
      <div className="hotel-hero">
        {venueName ? <p className="hotel-hero__venue">{venueName}</p> : null}
        <p className="hotel-hero__hello">{stay.guestName ? `Hola, ${firstName(stay.guestName)}` : 'Te damos la bienvenida'}</p>
        <h1 id="hotel-welcome-title">{stay.roomName ?? 'Tu habitación'}</h1>
        {details ? <p className="hotel-hero__details">{details}</p> : null}
      </div>
      <h2 className="hotel-section-title">¿Qué necesitas?</h2>
      <nav className="hotel-tiles" aria-label="Servicios del hotel">
        {tiles.map((tile) => (
          <Link key={tile.testId} className="hotel-tile hotel-tap" to={tile.to} data-testid={`hotel-tile-${tile.testId}`}>
            <strong>{tile.title}</strong>
            <span>{tile.subtitle}</span>
          </Link>
        ))}
      </nav>
      <Link className="alumno-btn alumno-btn--lime hotel-tap hotel-primary" to={`/e/${slug}`}>
        Pedir al cuarto
      </Link>
    </section>
  );
}

// endregion

// region Solicitudes (H05)

function HotelRequests({
  client,
  stay,
  config,
  home,
  onStayChange,
}: {
  client: HotelClient;
  stay: Stay;
  config: HotelConfig;
  home: string;
  onStayChange: (stay: Stay) => void;
}) {
  const [picked, setPicked] = useState<Partial<Record<RequestType, number>>>({});
  const [doNotDisturb, setDoNotDisturb] = useState(stay.doNotDisturb);
  const [dndAtStart, setDndAtStart] = useState(stay.doNotDisturb);
  const [open, setOpen] = useState<HotelRequest[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Un reintento de lo mismo no crea otra solicitud: la llave dura hasta que el servidor la acepta.
  // Otra cantidad es otra solicitud y estrena llave (la misma llave con otro cuerpo se rechaza).
  const keys = useRef(new Map<string, string>());

  const keyFor = (id: string) => {
    const existing = keys.current.get(id);
    if (existing) return existing;
    const created = createIdempotencyKey();
    keys.current.set(id, created);
    return created;
  };

  useEffect(() => {
    let active = true;
    void client
      .myRequests()
      .then((list) => {
        if (active) setOpen(list.filter(isOpenRequest));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [client]);

  const pendingCount = Object.keys(picked).length + (doNotDisturb !== dndAtStart ? 1 : 0);

  function tap(type: RequestType) {
    setPicked((current) => tapRequest(current, type));
    setError(null);
    setNotice(null);
  }

  async function submit() {
    if (submitting || pendingCount === 0) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    let sent = 0;
    let failure: unknown = null;
    const created: HotelRequest[] = [];
    let remaining = { ...picked };
    for (const [type, quantity] of Object.entries(picked) as Array<[RequestType, number]>) {
      const id = `request:${type}:${quantity}`;
      try {
        created.push(await client.createRequest(type, quantity, null, keyFor(id)));
        keys.current.delete(id);
        sent += 1;
        remaining = { ...remaining };
        delete remaining[type];
      } catch (cause) {
        failure = cause;
        break;
      }
    }
    setPicked(remaining);
    if (!failure && doNotDisturb !== dndAtStart) {
      try {
        onStayChange(await client.setDoNotDisturb(doNotDisturb));
        setDndAtStart(doNotDisturb);
        sent += 1;
      } catch (cause) {
        failure = cause;
      }
    }
    if (created.length > 0) {
      setOpen((current) => [...created, ...current.filter((item) => !created.some((made) => made.id === item.id))]);
    }
    setSubmitting(false);
    if (failure) {
      const prefix = sent > 0 ? `Enviamos ${sent}, pero faltaron algunas. ` : '';
      setError(prefix + hotelErrorMessage(failure, 'No pudimos enviar tu solicitud.'));
    } else {
      setNotice(sent === 1 ? 'Listo, ya le avisamos al hotel.' : `Listo, enviamos ${sent} solicitudes al hotel.`);
    }
  }

  async function cancel(id: string) {
    if (cancelling) return;
    setCancelling(id);
    setError(null);
    try {
      await client.cancelRequest(id, keyFor(`cancel:${id}`));
      keys.current.delete(`cancel:${id}`);
      setOpen((current) => current.filter((item) => item.id !== id));
    } catch (cause) {
      setError(hotelErrorMessage(cause, 'No pudimos cancelarla.'));
    } finally {
      setCancelling(null);
    }
  }

  const badge = (type: RequestType) => {
    const count = picked[type];
    if (!count) return null;
    return type === 'toallas' || type === 'almohadas' || type === 'cargador' ? String(count) : '✓';
  };

  return (
    <section className="hotel-requests" aria-labelledby="hotel-requests-title">
      <AlumnoPageHeader
        back={{ to: home, label: 'Volver' }}
        kicker={stay.roomName ?? 'Tu habitación'}
        title={<span id="hotel-requests-title">Pedir al hotel</span>}
      />
      {config.requestsEnabled ? (
        <div className="hotel-tiles" role="group" aria-label="Qué necesitas">
          {REQUEST_OPTIONS.map((option) => (
            <RequestTile
              key={option.type}
              title={option.title}
              subtitle={option.subtitle}
              badge={badge(option.type)}
              onClick={() => tap(option.type)}
            />
          ))}
          {config.lateCheckoutTime ? (
            <RequestTile
              title="Salida tardía"
              subtitle={lateCheckoutNote(config)}
              badge={badge('salida_tardia')}
              onClick={() => tap('salida_tardia')}
            />
          ) : null}
          {config.doNotDisturbEnabled ? (
            <RequestTile
              title="Sin molestar"
              subtitle="No tocar la puerta"
              badge={doNotDisturb ? 'Sí' : null}
              onClick={() => {
                setDoNotDisturb((value) => !value);
                setError(null);
                setNotice(null);
              }}
            />
          ) : null}
        </div>
      ) : (
        <p className="alumno-muted">Este hotel no recibe solicitudes desde la app. Llama a recepción.</p>
      )}
      {open.length > 0 ? (
        <div className="alumno-card hotel-panel">
          <h2>Tus solicitudes</h2>
          <ul className="hotel-open-list">
            {open.map((request) => (
              <li key={request.id}>
                <span>
                  <strong>
                    {request.quantity > 1 ? `${request.quantity} × ` : ''}
                    {REQUEST_LABEL[request.type]}
                  </strong>
                  <small>{REQUEST_STATUS_LABEL[request.status]}</small>
                </span>
                {request.status === 'pendiente' ? (
                  <button
                    type="button"
                    className="alumno-btn alumno-btn--ghost hotel-tap hotel-inline-btn"
                    disabled={cancelling !== null}
                    onClick={() => void cancel(request.id)}
                    aria-label={`Cancelar ${REQUEST_LABEL[request.type]}`}
                  >
                    {cancelling === request.id ? 'Cancelando…' : 'Cancelar'}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {error ? (
        <p className="alumno-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="hotel-notice" role="status">
          {notice}
        </p>
      ) : null}
      {config.requestsEnabled || config.doNotDisturbEnabled ? (
        <button
          type="button"
          className="alumno-btn alumno-btn--lime hotel-tap hotel-primary"
          disabled={pendingCount === 0 || submitting}
          onClick={() => void submit()}
        >
          {submitting ? 'Enviando…' : pendingCount > 0 ? `Enviar solicitud · ${pendingCount}` : 'Elige lo que necesitas'}
        </button>
      ) : null}
    </section>
  );
}

function RequestTile({
  title,
  subtitle,
  badge,
  onClick,
}: {
  title: string;
  subtitle: string;
  badge: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={badge ? 'hotel-tile hotel-tap is-selected' : 'hotel-tile hotel-tap'}
      aria-pressed={badge !== null}
      onClick={onClick}
    >
      {badge ? (
        <em className="hotel-tile__badge" aria-label={`Elegido: ${badge}`}>
          {badge}
        </em>
      ) : null}
      <strong>{title}</strong>
      <span>{subtitle}</span>
    </button>
  );
}

// endregion

// region Cuenta y salida (H06)

function HotelAccount({ stay, config, home, slug }: { stay: Stay; config: HotelConfig; home: string; slug: string }) {
  const headline = accountHeadline(stay);
  const lines = accountLines(stay);
  const cost = stayCost(stay);
  const closed = isClosedStay(stay);
  const departureDay = shortDate(stay.checkOut);
  const nights = stay.nights === 1 ? '1 noche' : `${stay.nights} noches`;
  return (
    <section className="hotel-account" aria-labelledby="hotel-account-title">
      <AlumnoPageHeader
        back={{ to: home, label: 'Volver' }}
        kicker={[stay.roomName ?? 'Tu habitación', departureDay ? `salida el ${departureDay}` : null].filter(Boolean).join(' · ')}
        title={<span id="hotel-account-title">Mi cuenta</span>}
      />
      <p className="hotel-account__label">{headline.label}</p>
      <p className="hotel-account__total" data-testid="hotel-account-total">
        {moneyLabel(headline.amount)}
      </p>
      <div className="alumno-card hotel-panel">
        {lines.length === 0 ? (
          <p className="alumno-muted">Todavía no tienes cargos. Lo que pidas al cuarto aparece aquí.</p>
        ) : (
          <ul className="hotel-lines">
            {lines.map((line, index) => (
              <li key={`${line.title}-${index}`}>
                <span>
                  <strong>{line.title}</strong>
                  {line.detail ? <small>{line.detail}</small> : null}
                </span>
                <b>{moneyLabel(line.amount)}</b>
              </li>
            ))}
          </ul>
        )}
      </div>
      {cost ? (
        <div className="alumno-card hotel-panel">
          <ul className="hotel-lines">
            <li>
              <span>
                <strong>Estancia ({nights})</strong>
                <small>{closed ? 'Pagada en recepción' : 'Se paga en recepción'}</small>
              </span>
              <b className="is-muted">{moneyLabel(cost)}</b>
            </li>
          </ul>
        </div>
      ) : null}
      <div className="alumno-card hotel-panel" aria-labelledby="hotel-checkout-title">
        <h2 id="hotel-checkout-title">Tu salida</h2>
        {closed ? (
          <p className="alumno-muted">Ya hiciste el check-out. Gracias por tu estancia.</p>
        ) : (
          <>
            <p>
              {departureDay ? `El ${departureDay}` : 'El día de tu salida'}
              {config.checkoutTime ? ` antes de las ${config.checkoutTime}` : ''}. Pasa a recepción a entregar la
              habitación y pagar tu cuenta.
            </p>
            {config.requestsEnabled && config.lateCheckoutTime ? (
              <Link className="alumno-btn alumno-btn--ghost hotel-tap" to={hotelPath(slug, 'solicitudes')}>
                Pedir salida tardía · {lateCheckoutNote(config)}
              </Link>
            ) : null}
          </>
        )}
      </div>
      <p className="alumno-muted">Los cargos de comida y servicios se suman a tu cuenta final.</p>
      <p className="hotel-paynote" role="note">
        {closed ? 'Cuenta cerrada · gracias por tu estancia' : 'Pagas en recepción al salir'}
      </p>
    </section>
  );
}

// endregion

// region Pedido al cuarto (H03)

type PayChoice = 'room' | 'card';

function HotelCheckout({
  client,
  slug,
  stay,
  config,
  cardOffered,
  roomId,
  home,
  afterOrder,
  onStayLost,
}: {
  client: HotelClient;
  slug: string;
  stay: Stay;
  config: HotelConfig;
  cardOffered: boolean;
  roomId: number | null;
  home: string;
  afterOrder: (order: OrderDetail, method: PaymentMethod) => void;
  onStayLost: () => void;
}) {
  const { cart, reset } = useCart();
  const lines = useMemo(() => (cart?.slug === slug ? cart.lines : []), [cart, slug]);
  const roomEnabled = config.chargeToRoom;
  const cardEnabled = config.cardAtOrderEnabled && cardOffered;
  const [choice, setChoice] = useState<PayChoice | null>(roomEnabled ? 'room' : cardEnabled ? 'card' : null);
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const method: PaymentMethod = choice === 'card' ? 'stripe' : 'efectivo';
  const total = cartTotal(lines, method);
  const roomLabel = stay.roomName ?? 'habitación';

  async function confirm() {
    if (busy.current || !choice || lines.length === 0 || roomId == null) return;
    busy.current = true;
    setCreating(true);
    setError(null);
    try {
      // El cargo a la cuenta va explícito: sin `pago_diferido` el servidor no lo infiere si se manda false.
      const payload = toCreateOrderInput(lines, method, notes, 'en_espacio', roomId, choice === 'room');
      const fingerprint = orderFingerprint(payload);
      const order = await client.createOrder(payload, idempotencyKeyFor(fingerprint));
      forgetIdempotencyKey(fingerprint);
      reset();
      afterOrder(order, method);
    } catch (cause) {
      if (cause instanceof VaiinillaApiError && cause.code === 'ROOM_REQUIRES_STAY') {
        onStayLost();
        return;
      }
      setError(hotelErrorMessage(cause, 'No pudimos enviar tu pedido.'));
    } finally {
      busy.current = false;
      setCreating(false);
    }
  }

  if (lines.length === 0) {
    return (
      <section className="hotel-checkout">
        <AlumnoPageHeader back={{ to: home, label: 'Volver' }} kicker="Pedido" title="Entrega a tu cuarto" />
        <p className="alumno-muted">Tu carrito está vacío. Elige algo del menú para pedirlo a tu habitación.</p>
        <Link className="alumno-btn alumno-btn--lime hotel-tap" to={`/e/${slug}`}>
          Ver el menú
        </Link>
      </section>
    );
  }

  return (
    <section className="hotel-checkout" aria-labelledby="hotel-checkout-heading">
      <AlumnoPageHeader
        back={{ to: `/e/${slug}`, label: 'Seguir pidiendo' }}
        kicker="Pedido"
        title={<span id="hotel-checkout-heading">Entrega a tu cuarto</span>}
      />
      <div className="alumno-card hotel-panel">
        <h2>Resumen</h2>
        <ul className="hotel-lines">
          {lines.map((line) => (
            <li key={`${line.productId}-${line.optionIds.join(',')}-${line.notes ?? ''}`}>
              <span>
                <strong>
                  {line.quantity} × {line.productName}
                </strong>
                {line.notes ? <small>{line.notes}</small> : null}
              </span>
              <b>{moneyLabel(linePreview(method === 'stripe' ? line.unitPreview : (line.unitCounter ?? line.unitPreview), line.quantity))}</b>
            </li>
          ))}
        </ul>
      </div>
      <div className="alumno-card hotel-panel">
        <h2>Cuándo lo quieres</h2>
        <p className="hotel-radio is-selected" aria-current="true">
          <strong>Lo antes posible</strong>
          <small>La cocina lo prepara y te lo lleva</small>
        </p>
      </div>
      <fieldset className="alumno-card hotel-panel hotel-pay">
        <legend>Cómo pagas</legend>
        {roomEnabled ? (
          <label className={choice === 'room' ? 'hotel-radio hotel-tap is-selected' : 'hotel-radio hotel-tap'}>
            <input type="radio" name="hotel-pay" checked={choice === 'room'} onChange={() => setChoice('room')} />
            <span>
              <strong>Cargar a la {roomLabel.charAt(0).toLowerCase() + roomLabel.slice(1)}</strong>
              <small>Se paga al salir</small>
            </span>
          </label>
        ) : null}
        {cardEnabled ? (
          <label className={choice === 'card' ? 'hotel-radio hotel-tap is-selected' : 'hotel-radio hotel-tap'}>
            <input type="radio" name="hotel-pay" checked={choice === 'card'} onChange={() => setChoice('card')} />
            <span>
              <strong>Tarjeta ahora</strong>
              <small>Pago seguro con Stripe</small>
            </span>
          </label>
        ) : null}
        {!roomEnabled && !cardEnabled ? (
          <p className="alumno-muted">Este hotel no recibe pedidos desde la app en este momento.</p>
        ) : null}
      </fieldset>
      <label className="hotel-note">
        <span>Nota para la cocina</span>
        <textarea
          value={notes}
          maxLength={300}
          placeholder="Ej. sin cebolla"
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>
      {error ? (
        <p className="alumno-error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className={creating ? 'alumno-btn alumno-btn--lime hotel-tap hotel-primary is-working' : 'alumno-btn alumno-btn--lime hotel-tap hotel-primary'}
        disabled={!choice || creating || roomId == null}
        onClick={() => void confirm()}
      >
        {creating ? 'Enviando…' : `Pedir · ${moneyLabel(total)}`}
      </button>
    </section>
  );
}

// endregion
