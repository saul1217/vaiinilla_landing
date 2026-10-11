// Estado de la pantalla de canchas: horario del día, selección, apartar y pagar. Espejo de
// ReservationsViewModel (Android). El cliente HTTP se inyecta para poder probarlo sin red.
import { useCallback, useEffect, useRef, useState } from 'react';
import { VaiinillaApiError, errorMessage } from './api-error';
import { createIdempotencyKey } from './idempotency';
import {
  PAID_NOTICE,
  availableDurations,
  isStartAvailable,
  type CourtDay,
  type CourtSchedule,
  type Reservation,
  type ReservationPayment,
  type ReservationPaymentMethod,
} from './reservations';

export interface ReservationsClient {
  day: (date?: string) => Promise<CourtDay>;
  list: () => Promise<Reservation[]>;
  create: (
    input: { courtId: number; start: number | null; durationMinutes: number },
    idempotencyKey: string,
  ) => Promise<Reservation>;
  pay: (id: string, method: ReservationPaymentMethod, idempotencyKey: string) => Promise<ReservationPayment>;
  cancel: (id: string, idempotencyKey: string) => Promise<Reservation>;
}

export interface ReservationsState {
  loading: boolean;
  day: CourtDay | null;
  /** "YYYY-MM-DD"; null = hoy. */
  selectedDate: string | null;
  selectedCourtId: number | null;
  /** Inicio elegido; con `rentNow` la renta empieza en cuanto se pague. */
  selectedStart: number | null;
  rentNow: boolean;
  selectedDuration: number | null;
  mine: Reservation[];
  /** Reserva apartada esperando que el cliente elija cómo pagar. */
  pending: Reservation | null;
  working: boolean;
  error: string | null;
  /** El servidor negó apartar (403): un invitado sin escaneo reciente debe entrar o crear cuenta. */
  denied: boolean;
  notice: string | null;
}

const POLL_MS = 15_000;

const INITIAL: ReservationsState = {
  loading: true,
  day: null,
  selectedDate: null,
  selectedCourtId: null,
  selectedStart: null,
  rentNow: false,
  selectedDuration: null,
  mine: [],
  pending: null,
  working: false,
  error: null,
  denied: false,
  notice: null,
};

/** La lista cargada solo vale si es de la fecha que el cliente eligió. */
function dayMatchesSelection(state: ReservationsState): boolean {
  return !state.day || state.day.date === (state.selectedDate ?? state.day.today);
}

export function selectedCourt(state: ReservationsState): CourtSchedule | null {
  if (!dayMatchesSelection(state)) return null;
  return state.day?.courts.find((court) => court.id === state.selectedCourtId) ?? null;
}

export function canReserve(state: ReservationsState): boolean {
  return (
    selectedCourt(state) !== null &&
    state.selectedDuration !== null &&
    (state.rentNow || state.selectedStart !== null) &&
    !state.working
  );
}

export function useReservations(
  client: ReservationsClient,
  onPaid: (payment: ReservationPayment, method: ReservationPaymentMethod) => void,
) {
  const [state, setState] = useState<ReservationsState>(INITIAL);
  const stateRef = useRef(state);
  stateRef.current = state;
  const clientRef = useRef(client);
  clientRef.current = client;
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;
  const alive = useRef(true);

  const patch = useCallback((next: Partial<ReservationsState>) => {
    if (alive.current) setState((current) => ({ ...current, ...next }));
  }, []);

  const requestSeq = useRef(0);

  const refresh = useCallback(async (dateOverride?: string | null) => {
    // `selectDate` aún no se renderiza cuando refresca: la fecha viaja explícita.
    const date = (dateOverride !== undefined ? dateOverride : stateRef.current.selectedDate) ?? undefined;
    const seq = ++requestSeq.current;
    const [dayResult, mineResult] = await Promise.allSettled([
      clientRef.current.day(date),
      clientRef.current.list(),
    ]);
    // Una respuesta más vieja que otra ya pedida no reemplaza la lista del día elegido.
    if (!alive.current || seq !== requestSeq.current) return;
    setState((current) => {
      const day = dayResult.status === 'fulfilled' ? dayResult.value : null;
      const courtId =
        (current.selectedCourtId !== null && day?.courts.some((c) => c.id === current.selectedCourtId)
          ? current.selectedCourtId
          : null) ??
        day?.courts.find((c) => c.rentable)?.id ??
        day?.courts[0]?.id ??
        current.selectedCourtId;
      const court = day?.courts.find((c) => c.id === courtId);
      // Un inicio que alguien más tomó mientras tanto deja de estar elegido.
      const stillFree =
        current.selectedStart === null || !day || !court || isStartAvailable(day, court, current.selectedStart);
      return {
        ...current,
        loading: false,
        day: day ?? current.day,
        selectedCourtId: courtId,
        mine: mineResult.status === 'fulfilled' ? mineResult.value : current.mine,
        selectedStart: stillFree ? current.selectedStart : null,
        error:
          current.error ??
          (dayResult.status === 'rejected' ? `No pudimos cargar las canchas. ${errorMessage(dayResult.reason)}` : null),
      };
    });
  }, []);

  useEffect(() => {
    alive.current = true;
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') void refresh();
    }, POLL_MS);
    return () => {
      alive.current = false;
      window.clearInterval(timer);
    };
  }, [refresh]);

  const selectDate = useCallback(
    (date: string) => {
      const today = stateRef.current.day?.today;
      const selectedDate = date === today ? null : date;
      patch({
        selectedDate,
        selectedStart: null,
        rentNow: false,
        selectedDuration: null,
        loading: true,
      });
      void refresh(selectedDate);
    },
    [patch, refresh],
  );

  const selectCourt = useCallback(
    (courtId: number) => patch({ selectedCourtId: courtId, selectedStart: null, rentNow: false, selectedDuration: null }),
    [patch],
  );

  const selectRentNow = useCallback(() => {
    const { day } = stateRef.current;
    const court = selectedCourt(stateRef.current);
    if (!day || !court) return;
    patch({
      rentNow: true,
      selectedStart: null,
      selectedDuration: availableDurations(day, court, day.now)[0] ?? null,
    });
  }, [patch]);

  const selectStart = useCallback(
    (start: number) => {
      const current = stateRef.current;
      const court = selectedCourt(current);
      if (!current.day || !court) return;
      const durations = availableDurations(current.day, court, start);
      patch({
        rentNow: false,
        selectedStart: start,
        selectedDuration:
          current.selectedDuration !== null && durations.includes(current.selectedDuration)
            ? current.selectedDuration
            : (durations[0] ?? null),
      });
    },
    [patch],
  );

  const selectDuration = useCallback((minutes: number) => patch({ selectedDuration: minutes }), [patch]);
  const dismissMessages = useCallback(() => patch({ error: null, denied: false, notice: null }), [patch]);

  /** Aparta la cancha y abre la elección del pago. */
  const reserve = useCallback(async () => {
    const current = stateRef.current;
    const court = selectedCourt(current);
    if (!canReserve(current) || !court || current.selectedDuration === null) return;
    patch({ working: true, error: null, denied: false, notice: null });
    try {
      const reservation = await clientRef.current.create(
        {
          courtId: court.id,
          start: current.rentNow ? null : current.selectedStart,
          durationMinutes: current.selectedDuration,
        },
        createIdempotencyKey(),
      );
      setState((now) => ({
        ...now,
        working: false,
        pending: reservation,
        selectedStart: null,
        rentNow: false,
        mine: [reservation, ...now.mine.filter((r) => r.id !== reservation.id)],
      }));
    } catch (cause) {
      const denied = cause instanceof VaiinillaApiError && cause.status === 403;
      // Nunca en silencio: el mensaje del servidor lleva su código para poder reportarlo.
      const code = cause instanceof VaiinillaApiError && cause.code ? ` (${cause.code})` : '';
      patch({ working: false, denied, error: `${errorMessage(cause)}${code}` });
    }
    await refresh();
  }, [patch, refresh]);

  /** Retoma el pago de una reserva que sigue apartada. */
  const resumePayment = useCallback(
    (reservation: Reservation) => {
      if (reservation.state === 'pendiente_pago') patch({ pending: reservation, error: null });
    },
    [patch],
  );
  const dismissPayment = useCallback(() => patch({ pending: null }), [patch]);

  const pay = useCallback(
    async (method: ReservationPaymentMethod) => {
      const reservation = stateRef.current.pending;
      if (!reservation) return;
      patch({ working: true, error: null });
      try {
        const payment = await clientRef.current.pay(reservation.id, method, createIdempotencyKey());
        setState((now) => ({
          ...now,
          working: false,
          pending: null,
          notice: PAID_NOTICE[method],
          mine: now.mine.map((r) => (r.id === payment.reservation.id ? payment.reservation : r)),
        }));
        onPaidRef.current(payment, method);
      } catch (cause) {
        const msg = errorMessage(cause);
        const isExpired =
          msg.toLowerCase().includes('venció') ||
          msg.toLowerCase().includes('expir') ||
          msg.toLowerCase().includes('tiempo');
        patch({
          working: false,
          pending: isExpired ? null : stateRef.current.pending,
          error: isExpired
            ? 'Tiempo de espera agotado: se apartó pero no se completó el pago dentro de los 10 minutos. Tu apartado fue cancelado; por favor elige el horario nuevamente.'
            : msg,
        });
      }
      await refresh();
    },
    [patch, refresh],
  );

  const cancel = useCallback(
    async (reservation: Reservation) => {
      patch({ working: true, error: null });
      try {
        const cancelled = await clientRef.current.cancel(reservation.id, createIdempotencyKey());
        // Sin esperar al siguiente refresco: la tarjeta deja de verse como activa al instante.
        setState((now) => ({
          ...now,
          working: false,
          pending: null,
          notice: 'Reserva cancelada.',
          mine: now.mine.map((r) => (r.id === cancelled.id ? cancelled : r)),
        }));
      } catch (cause) {
        patch({ working: false, error: errorMessage(cause) });
      }
      await refresh();
    },
    [patch, refresh],
  );

  return {
    state,
    selectDate,
    selectCourt,
    selectRentNow,
    selectStart,
    selectDuration,
    dismissMessages,
    reserve,
    resumePayment,
    dismissPayment,
    pay,
    cancel,
  };
}
