// Renta de canchas del cliente: elegir día, cancha, hora y duración, apartar 10 minutos y pagar.
// Espejo de ReservationsScreen (Android). La renta se paga primero; sin pagar no se puede pedir
// comida en la cancha. Pagar crea un pedido de renta normal y se sigue en su pantalla de pedido.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { MotionSheet } from '../components/motion-sheet';
import { RollingNumber } from '../components/rolling-number';
import { SlidingChips } from '../components/sliding-chips';
import { useAuth } from '../context/auth-context';
import { useBuyerSession } from '../context/buyer-session';
import { errorMessage } from '../lib/api-error';
import { productImageUrl } from '../lib/catalog-images';
import { resolveClientSession } from '../lib/client-session';
import { createReservationsClient } from '../lib/reservations-client';
import { formatAmount } from '../lib/money';
import { rememberPickupQrToken } from '../lib/pickup-qr';
import { savePendingStripeOrderId } from '../lib/stripe-pending';
import { rememberStripeCheckoutSession, stripeSessionFromCreatedOrder } from '../lib/stripe-session';
import { useHeightMorph } from '../lib/use-height-morph';
import {
  canReserve,
  selectedCourt,
  useReservations,
  type ReservationsClient,
  type ReservationsState,
} from '../lib/use-reservations';
import {
  RESERVATION_STATE_LABEL,
  addDays,
  amountFor,
  availableDurations,
  busyUntil,
  canRentNow,
  clock,
  dayChipLabel,
  dayLongLabel,
  durationLabel,
  formatHour,
  isLiveReservation,
  isStartAvailable,
  localDate,
  startTimes,
  type CourtDay,
  type CourtSchedule,
  type Reservation,
  type ReservationPayment,
  type ReservationPaymentMethod,
} from '../lib/reservations';
import type { PublicEstablishment } from '../types/api';
import { LoadingSkeleton } from '../components/loading-skeleton';

export function ReservationsPage() {
  const { slug = '' } = useParams();
  const { user, ready } = useAuth();
  const { context, openClientSession } = useBuyerSession();
  const [place, setPlace] = useState<PublicEstablishment | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const openRef = useRef(openClientSession);
  openRef.current = openClientSession;

  useEffect(() => {
    if (!ready || !user) return;
    let active = true;
    void resolveClientSession({ user, context, preferredSlug: slug, openClientSession: openRef.current })
      .then((resolved) => {
        if (!active) return;
        if (!resolved) {
          setError('Entra a un establecimiento para rentar una cancha.');
          return;
        }
        setPlace(resolved.place);
        setToken(resolved.context.access_token);
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [context, ready, slug, user]);

  if (ready && !user) return <Navigate to={`/cuenta?next=/e/${slug}/canchas`} replace />;

  return (
    <AppShell tab="menu">
      <main id="main-content" className="alumno-main">
        <ReservationsHeader slug={slug} venueName={place?.nombre ?? null} />
        {error ? <p className="alumno-error">{error}</p> : null}
        {token ? <ReservationsScreen client={createReservationsClient(token)} slug={slug} /> : error ? null : (
          <LoadingSkeleton shape="rows" label="Abriendo tu sesión…" />
        )}
      </main>
    </AppShell>
  );
}

function ReservationsHeader({ slug, venueName }: { slug: string; venueName: string | null }) {
  return (
    <>
      <AlumnoPageHeader kicker="Canchas" title="Renta tu cancha" back={{ to: `/e/${slug}`, label: 'Volver' }} />
      <p className="alumno-place-name">{[venueName, 'se paga al apartar'].filter(Boolean).join(' · ')}</p>
    </>
  );
}

/** La pantalla sin sesión ni encabezado: se prueba y se ve en QA con un cliente simulado. */
export function ReservationsScreen({ client, slug }: { client: ReservationsClient; slug: string }) {
  const navigate = useNavigate();
  const [confirmCancel, setConfirmCancel] = useState<Reservation | null>(null);

  function onPaid(payment: ReservationPayment, method: ReservationPaymentMethod) {
    const order = payment.order;
    if (!order) return;
    rememberPickupQrToken(order.id, order.qr_token);
    if (method === 'stripe') {
      try {
        rememberStripeCheckoutSession(order.id, stripeSessionFromCreatedOrder(order));
        savePendingStripeOrderId(order.id);
      } catch {
        // Sin hoja de pago el detalle del pedido ofrece reintentar.
      }
    }
    void navigate(`/cuenta/pedidos/${order.id}`);
  }

  const vm = useReservations(client, onPaid);
  const { state } = vm;
  const day = state.day;
  const court = selectedCourt(state);
  const zone = day?.timeZone ?? 'UTC';
  const start = state.rentNow ? (day?.now ?? null) : state.selectedStart;
  const bodyRef = useRef<HTMLDivElement>(null);
  useHeightMorph(bodyRef, `${court?.id}:${start !== null}:${state.pending?.id ?? ''}`);

  const mine = state.mine.filter((r) => isLiveReservation(r.state) || r.state === 'conflicto');

  return (
    <div className="alumno-res" data-slug={slug}>
      {state.error ? <Banner message={state.error} tone="coral" onDismiss={vm.dismissMessages} /> : null}
      {state.notice ? <Banner message={state.notice} tone="lime" onDismiss={vm.dismissMessages} /> : null}

      {!day ? (
        state.loading ? (
          <LoadingSkeleton shape="rows" label="Cargando canchas…" />
        ) : (
          <p className="alumno-muted alumno-res__empty">Este lugar todavía no renta canchas.</p>
        )
      ) : !day.courts.some((c) => c.rentable) ? (
        <p className="alumno-muted alumno-res__empty">
          Por ahora las canchas de este lugar no se rentan desde la app. Pregunta en caja.
        </p>
      ) : (
        <div className="alumno-res__flow alumno-arrive" ref={bodyRef}>
          <DateStrip day={day} selected={state.selectedDate ?? day.today} onSelect={vm.selectDate} />
          <CourtStrip day={day} selectedId={state.selectedCourtId} onSelect={vm.selectCourt} />
          {court && hasProfile(court) ? <CourtProfileCard key={`p-${court.id}`} court={court} /> : null}
          {court?.rentable ? (
            <>
              {canRentNow(day, court) ? (
                <RentNowCard key="now" selected={state.rentNow} onClick={vm.selectRentNow} />
              ) : null}
              <HourGrid
                day={day}
                court={court}
                selected={state.selectedStart}
                onSelect={vm.selectStart}
              />
              {start !== null ? (
                <>
                  <DurationRow
                    key="durations"
                    available={availableDurations(day, court, start)}
                    all={day.durations}
                    selected={state.selectedDuration}
                    onSelect={vm.selectDuration}
                  />
                  <Summary
                    key="summary"
                    state={state}
                    day={day}
                    court={court}
                    start={start}
                    onReserve={() => void vm.reserve()}
                  />
                </>
              ) : null}
            </>
          ) : null}
        </div>
      )}

      {mine.length > 0 ? (
        <section className="alumno-res__mine alumno-arrive" aria-labelledby="res-mine">
          <h2 className="alumno-section-label" id="res-mine">
            Mis reservas
          </h2>
          {mine.map((reservation) => (
            <MyReservation
              key={reservation.id}
              reservation={reservation}
              zone={zone}
              today={day?.today ?? ''}
              onPay={() => vm.resumePayment(reservation)}
              onCancel={() => setConfirmCancel(reservation)}
            />
          ))}
        </section>
      ) : null}

      {state.pending ? (
        <PaySheet
          reservation={state.pending}
          zone={zone}
          working={state.working}
          error={state.error}
          onPay={(method) => void vm.pay(method)}
          onClosed={vm.dismissPayment}
        />
      ) : null}

      {confirmCancel ? (
        <ConfirmSheet
          title="¿Cancelar la reserva?"
          message={
            confirmCancel.state === 'pendiente_pago'
              ? 'Se libera el horario y no se te cobra nada.'
              : 'Se libera la cancha, pero lo que pagaste no se devuelve.'
          }
          confirmLabel="Sí, cancelar"
          dismissLabel="No, mantenerla"
          onConfirm={() => {
            const reservation = confirmCancel;
            setConfirmCancel(null);
            void vm.cancel(reservation);
          }}
          onClosed={() => setConfirmCancel(null)}
        />
      ) : null}
    </div>
  );
}

function hasProfile(court: CourtSchedule): boolean {
  const { description, imageUrl, features } = court.profile;
  return Boolean(description || imageUrl || features.length > 0);
}

function Banner({ message, tone, onDismiss }: { message: string; tone: 'coral' | 'lime'; onDismiss: () => void }) {
  return (
    <div key={message} className={`alumno-res__banner alumno-res__banner--${tone}`} role="status">
      <p>{message}</p>
      <button type="button" onClick={onDismiss}>
        Ok
      </button>
    </div>
  );
}

function DateStrip({
  day,
  selected,
  onSelect,
}: {
  day: CourtDay;
  selected: string;
  onSelect: (date: string) => void;
}) {
  const items = useMemo(
    () =>
      Array.from({ length: Math.min(day.daysAhead, 13) + 1 }, (_, i) => {
        const date = addDays(day.today, i);
        return { key: date, label: dayChipLabel(date, day.today) };
      }),
    [day.today, day.daysAhead],
  );
  return <SlidingChips label="Día" items={items} selected={selected} onSelect={onSelect} />;
}

function CourtStrip({
  day,
  selectedId,
  onSelect,
}: {
  day: CourtDay;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const isToday = day.date === day.today;
  return (
    <div className="alumno-res__courts" role="radiogroup" aria-label="Cancha">
      {day.courts
        .filter((court) => court.rentable)
        .map((court) => {
          const until = isToday ? busyUntil(court, day.now) : null;
          const looksFree = isToday ? until === null : court.busy.length === 0;
          const selected = court.id === selectedId;
          return (
            <button
              key={court.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={selected ? 'alumno-res__court is-on' : 'alumno-res__court'}
              onClick={() => onSelect(court.id)}
            >
              <strong>{court.name}</strong>
              {court.customerPricePerHour ? (
                <span>{formatAmount(court.customerPricePerHour.cashOrBalance)} / hora</span>
              ) : null}
              <span className="alumno-res__status">
                <i className={looksFree ? 'is-free' : 'is-busy'} aria-hidden="true" />
                {until !== null
                  ? `Se libera ${formatHour(until, day.timeZone)}`
                  : isToday
                    ? 'Libre ahora'
                    : court.busy.length === 0
                      ? 'Libre todo el día'
                      : 'Con horarios ocupados'}
              </span>
            </button>
          );
        })}
    </div>
  );
}

/** Ficha que escribió el dueño: foto (se abre en grande), descripción y características. */
function CourtProfileCard({ court }: { court: CourtSchedule }) {
  const [zoomed, setZoomed] = useState(false);
  const photo = productImageUrl(court.profile.imageUrl);
  return (
    <article className="alumno-res__profile" aria-label={`Ficha de ${court.name}`}>
      {photo ? (
        <button
          type="button"
          className="alumno-res__photo"
          onClick={() => setZoomed(true)}
          aria-label={`Ver la foto de ${court.name} en grande`}
        >
          <img src={photo} alt={`Foto de ${court.name}`} loading="lazy" />
        </button>
      ) : null}
      <div className="alumno-res__profile-body">
        <h2>{court.name}</h2>
        {court.profile.description ? <p>{court.profile.description}</p> : null}
        {court.profile.features.length > 0 ? (
          <ul className="alumno-res__tags">
            {court.profile.features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        ) : null}
      </div>
      {zoomed && photo ? <Lightbox src={photo} alt={`Foto de ${court.name}`} onClose={() => setZoomed(false)} /> : null}
    </article>
  );
}

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="alumno-res__lightbox" role="dialog" aria-modal="true" aria-label={alt} onClick={onClose}>
      <img src={src} alt={alt} />
      <button type="button" aria-label="Cerrar foto" onClick={onClose}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}

function RentNowCard({ selected, onClick }: { selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={selected ? 'alumno-res__now is-on' : 'alumno-res__now'}
      aria-pressed={selected}
      onClick={onClick}
    >
      <span>
        <strong>Rentar ahora</strong>
        <small>Empieza en cuanto pagues.</small>
      </span>
      <em>{selected ? 'Elegido' : 'Elegir'}</em>
    </button>
  );
}

function HourGrid({
  day,
  court,
  selected,
  onSelect,
}: {
  day: CourtDay;
  court: CourtSchedule;
  selected: number | null;
  onSelect: (start: number) => void;
}) {
  const starts = useMemo(() => startTimes(day), [day]);
  return (
    <section aria-labelledby="res-hours" className="alumno-res__block">
      <h2 id="res-hours">{day.date === day.today ? 'O aparta una hora de hoy' : 'Elige la hora'}</h2>
      {starts.length === 0 ? <p className="alumno-muted">Ya no quedan horarios este día.</p> : null}
      <div className="alumno-res__hours" role="radiogroup" aria-label="Hora de inicio">
        {starts.map((start) => {
          const free = isStartAvailable(day, court, start);
          return (
            <button
              key={start}
              type="button"
              role="radio"
              aria-checked={start === selected}
              disabled={!free}
              className={start === selected ? 'alumno-res__hour is-on' : 'alumno-res__hour'}
              onClick={() => onSelect(start)}
            >
              {formatHour(start, day.timeZone)}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function DurationRow({
  available,
  all,
  selected,
  onSelect,
}: {
  available: number[];
  all: number[];
  selected: number | null;
  onSelect: (minutes: number) => void;
}) {
  const items = all.map((minutes) => ({
    key: String(minutes),
    label: durationLabel(minutes),
    disabled: !available.includes(minutes),
  }));
  return (
    <section aria-labelledby="res-duration" className="alumno-res__block alumno-arrive">
      <h2 id="res-duration">¿Cuánto tiempo?</h2>
      <SlidingChips
        label="Duración"
        items={items}
        selected={selected === null ? null : String(selected)}
        onSelect={(key) => onSelect(Number(key))}
      />
    </section>
  );
}

function Summary({
  state,
  day,
  court,
  start,
  onReserve,
}: {
  state: ReservationsState;
  day: CourtDay;
  court: CourtSchedule;
  start: number;
  onReserve: () => void;
}) {
  const minutes = state.selectedDuration;
  const end = minutes === null ? null : start + minutes * 60_000;
  const price =
    minutes !== null && court.customerPricePerHour ? amountFor(court.customerPricePerHour.cashOrBalance, minutes) : null;
  const date = localDate(start, day.timeZone);
  const ref = useRef<HTMLElement>(null);
  // En el teléfono el resumen aparece bajo el pliegue y la barra de navegación tapa el botón:
  // al aparecer, se trae a la vista (con margen para esa barra). Se espera a que termine de crecer
  // el contenedor (su altura se anima ~520 ms); si no, el destino se calcula con la altura vieja.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const el = ref.current;
      if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, SCROLL_AFTER_MORPH_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <section ref={ref} className="alumno-res__summary alumno-arrive" aria-label="Resumen de tu renta">
      <p className="alumno-res__summary-kicker">
        {court.name} · {dayLongLabel(date, day.today)}
      </p>
      <p className="alumno-res__summary-time">
        {end !== null
          ? `${state.rentNow ? 'Ahora' : formatHour(start, day.timeZone)} – ${formatHour(end, day.timeZone)}`
          : 'Elige cuánto tiempo'}
      </p>
      {price ? (
        <p className="alumno-res__summary-price">
          <span aria-hidden="true">$</span>
          <RollingNumber value={price} />
          <small>con efectivo o saldo</small>
        </p>
      ) : null}
      <p className="alumno-res__summary-note">
        Se aparta {day.holdMinutes} minutos mientras pagas. Si cancelas, lo pagado no se devuelve.
      </p>
      <button
        type="button"
        className={state.working ? 'alumno-btn alumno-btn--lime is-working' : 'alumno-btn alumno-btn--lime'}
        disabled={!canReserve(state)}
        onClick={onReserve}
      >
        <span key={state.working ? 'work' : 'idle'} className="alumno-res__btn-label">
          {state.working ? 'Apartando…' : 'Apartar cancha'}
        </span>
      </button>
    </section>
  );
}

/** Un poco más que lo que tarda en crecer el contenedor (useHeightMorph: 520 ms). */
const SCROLL_AFTER_MORPH_MS = 600;

const PAY_OPTIONS: Array<{
  method: ReservationPaymentMethod;
  title: string;
  detail: string;
  price: 'card' | 'cash';
}> = [
  { method: 'saldo', title: 'Saldo', detail: 'Se paga al instante con tu cartera.', price: 'cash' },
  { method: 'stripe', title: 'Tarjeta', detail: 'Pago seguro con tu tarjeta.', price: 'card' },
  {
    method: 'efectivo',
    title: 'Efectivo en caja',
    detail: 'Paga en caja antes de que venza el apartado.',
    price: 'cash',
  },
];

function PaySheet({
  reservation,
  zone,
  working,
  error,
  onPay,
  onClosed,
}: {
  reservation: Reservation;
  zone: string;
  working: boolean;
  error: string | null;
  onPay: (method: ReservationPaymentMethod) => void;
  onClosed: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [reservation.id]);
  const remaining = reservation.holdExpiresAt === null ? null : Math.max(0, reservation.holdExpiresAt - now);
  const expired = remaining === 0;
  return (
    <MotionSheet className="alumno-sheet alumno-codesheet alumno-paysheet" labelledBy="res-pay-title" onClosed={onClosed}>
      {(close, dragHandle) => (
        <div className="alumno-codesheet__panel">
          <div className="alumno-codesheet__grab" {...dragHandle}>
            <span aria-hidden="true" />
          </div>
          <div className="alumno-paysheet__head">
            <h2 id="res-pay-title">Paga tu cancha</h2>
            <button type="button" className="alumno-paysheet__close" onClick={close} aria-label="Cerrar">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <p className="alumno-res__pay-what">
            {reservation.courtName ?? 'Cancha'} · {formatHour(reservation.start, zone)} –{' '}
            {formatHour(reservation.end, zone)}
          </p>
          {remaining !== null ? (
            <p
              className={expired || remaining < 60_000 ? 'alumno-res__hold is-low' : 'alumno-res__hold'}
              role="timer"
              aria-live="off"
            >
              {expired ? 'Venció el apartado: vuelve a elegir el horario.' : `Apartada por ${clock(remaining)}`}
            </p>
          ) : null}
          <div className="alumno-res__pay-list alumno-arrive">
            {PAY_OPTIONS.map((option) => {
              const prices = reservation.customerPrice;
              const amount = prices
                ? option.price === 'card'
                  ? prices.card
                  : prices.cashOrBalance
                : reservation.amount;
              return (
                <button
                  key={option.method}
                  type="button"
                  className="alumno-res__pay"
                  disabled={working || expired}
                  onClick={() => onPay(option.method)}
                >
                  <span>
                    <strong>{option.title}</strong>
                    <small>{option.detail}</small>
                  </span>
                  <b>{formatAmount(amount)}</b>
                </button>
              );
            })}
          </div>
          {error ? <p className="alumno-error">{error}</p> : null}
        </div>
      )}
    </MotionSheet>
  );
}

function ConfirmSheet({
  title,
  message,
  confirmLabel,
  dismissLabel,
  onConfirm,
  onClosed,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  dismissLabel: string;
  onConfirm: () => void;
  onClosed: () => void;
}) {
  return (
    <MotionSheet className="alumno-sheet alumno-codesheet alumno-paysheet" labelledBy="res-confirm-title" onClosed={onClosed}>
      {(close, dragHandle) => (
        <div className="alumno-codesheet__panel">
          <div className="alumno-codesheet__grab" {...dragHandle}>
            <span aria-hidden="true" />
          </div>
          <h2 id="res-confirm-title">{title}</h2>
          <p className="alumno-res__pay-what">{message}</p>
          <button type="button" className="alumno-btn alumno-btn--lime" onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button type="button" className="alumno-res__ghost" onClick={close}>
            {dismissLabel}
          </button>
        </div>
      )}
    </MotionSheet>
  );
}

function MyReservation({
  reservation,
  zone,
  today,
  onPay,
  onCancel,
}: {
  reservation: Reservation;
  zone: string;
  today: string;
  onPay: () => void;
  onCancel: () => void;
}) {
  const started = reservation.start <= Date.now();
  const date = localDate(reservation.start, zone);
  const cancellable =
    reservation.state === 'pendiente_pago' || (reservation.state === 'confirmada' && !started);
  return (
    <article className="alumno-res__mine-card">
      <header>
        <strong>{reservation.courtName ?? 'Cancha'}</strong>
        <span className={`alumno-res__badge is-${reservation.state}`}>{RESERVATION_STATE_LABEL[reservation.state]}</span>
      </header>
      <p>
        {dayLongLabel(date, today)} · {formatHour(reservation.start, zone)} – {formatHour(reservation.end, zone)}
      </p>
      <div className="alumno-res__actions">
        {reservation.state === 'pendiente_pago' ? (
          <button type="button" className="alumno-res__small is-filled" onClick={onPay}>
            Pagar
          </button>
        ) : null}
        {cancellable ? (
          <button type="button" className="alumno-res__small" onClick={onCancel}>
            Cancelar
          </button>
        ) : null}
      </div>
    </article>
  );
}
