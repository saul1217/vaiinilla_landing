// Botón flotante y arrastrable de "Llamar al mesero". Se monta una sola vez en la raíz de
// las rutas del cliente y aparece solo con una mesa escaneada. Al soltar se pega a la
// orilla izquierda o derecha; la posición vive en localStorage. Contrato del backend:
// docs/mesero-backend.md (la llamada va a la mesa, sin pedido).
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { Link, useLocation } from 'react-router-dom';
import { errorMessage, VaiinillaApiError } from '../lib/api-error';
import { readStoredClientContext } from '../lib/client-session';
import {
  clampY,
  snapSide,
  FAB_MARGIN,
  FAB_SIZE,
  fabBounds,
  readFabPosition,
  TAP_SLOP,
  useFloatingCallHidden,
  writeFabPosition,
  type FabPosition,
} from '../lib/floating-call';
import {
  CALL_REASONS,
  CALL_COOLDOWN_S,
  CallsUnavailableError,
  createBuyerCallClient,
  type BuyerCallClient,
  type CallReason,
  type TableCall,
} from '../lib/mesero-api';
import { scannedSpace } from '../lib/space-session';

const POLL_MS = 5000;
const HIDDEN_PATHS = [/^\/$/, /^\/soporte\/?$/, /^\/u\//, /^\/seguimiento\//];

type View = 'closed' | 'reasons' | 'open' | 'unavailable';

const isDesktop = () => window.matchMedia?.('(min-width: 768px)').matches ?? false;

/** En pantalla ancha la barra lateral ocupa la orilla izquierda (232 px, en espejo con alumno.css). */
const sidebarInset = () => (window.matchMedia?.('(min-width: 1024px)').matches ? 232 : 0);

interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  originLeft: number;
  originTop: number;
  moved: boolean;
}

export function FloatingCallWaiter({ client: injected }: { client?: BuyerCallClient }) {
  const { pathname } = useLocation();
  const hidden = useFloatingCallHidden();
  const isCart = /\/carrito\/?$/.test(pathname);
  const panelId = useId();
  const headingId = useId();
  const cooldownText = useRef<HTMLSpanElement>(null);
  const autoCollapsed = useRef(false);
  const firstOption = useRef<HTMLButtonElement>(null);
  const [collapsed, setCollapsed] = useState(() => window.scrollY > 8);
  const [needsJoin, setNeedsJoin] = useState(false);
  const [space, setSpace] = useState(() => scannedSpace());
  const [saved, setSaved] = useState<FabPosition | null>(() => readFabPosition());
  const [live, setLive] = useState<{ left: number; top: number } | null>(null);
  const [view, setView] = useState<View>('closed');
  const [call, setCall] = useState<TableCall | null>(null);
  const callRef = useRef<TableCall | null>(null);
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [, setViewport] = useState(0);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const button = useRef<HTMLButtonElement>(null);

  // La mesa puede cambiar sin navegar (salir de la mesa, vencer la visita).
  useEffect(() => {
    setSpace(scannedSpace());
  }, [pathname]);

  // El botón sale con la mesa guardada en el dispositivo; la sesión del cliente puede llegar
  // después del backend y solo hace falta para llamar, no para mostrarlo.
  const [token, setToken] = useState(() => readStoredClientContext()?.context.access_token);
  useEffect(() => {
    if (!space || injected) return;
    const sync = () => setToken(readStoredClientContext()?.context.access_token);
    sync();
    const id = window.setInterval(sync, 1000);
    return () => window.clearInterval(id);
  }, [space, injected, pathname]);
  const client = useMemo(
    () => injected ?? (token ? createBuyerCallClient(token) : null),
    [injected, token],
  );
  const espacioId = space?.espacioId ?? 0;
  const visible =
    Boolean(space) && !hidden && !HIDDEN_PATHS.some((pattern) => pattern.test(pathname));

  useEffect(() => {
    const onResize = () => setViewport((n) => n + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const collapseIfShort = () => {
      if (document.documentElement.scrollHeight <= window.innerHeight) {
        autoCollapsed.current = true;
        setCollapsed(true);
      }
    };
    const onScroll = () => {
      collapseIfShort();
      setCollapsed(autoCollapsed.current || window.scrollY > 8);
    };
    const timer = window.setTimeout(collapseIfShort, 4000);
    document.addEventListener('pointerdown', collapseIfShort, true);
    document.addEventListener('keydown', collapseIfShort, true);
    document.addEventListener('scroll', collapseIfShort, true);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', collapseIfShort, true);
      document.removeEventListener('keydown', collapseIfShort, true);
      document.removeEventListener('scroll', collapseIfShort, true);
      window.removeEventListener('scroll', onScroll);
    };
  }, [visible, pathname]);

  useEffect(() => {
    if (visible && view === 'reasons') (cooldownText.current ?? firstOption.current)?.focus();
  }, [visible, view]);

  // Recupera una llamada abierta tras recargar y la mantiene al día.
  useEffect(() => {
    if (!client || !espacioId) return;
    let active = true;
    const tick = async () => {
      setSpace(scannedSpace());
      try {
        const current = await client.current(espacioId);
        if (!active) return;
        const previous = callRef.current;
        callRef.current = current;
        setCall(current);
        if (previous && !current) {
          // An absent open call can also have expired or been cancelled.
          const finalState = await client.finalState?.(previous.id).catch(() => null);
          if (!active) return;
          if (finalState === 'atendida') setCooldown(CALL_COOLDOWN_S);
        }
        setView((v) => (current ? 'open' : v === 'open' ? 'closed' : v));
      } catch (cause) {
        if (active && cause instanceof CallsUnavailableError) setView('unavailable');
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [client, espacioId]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const panelOpen = view !== 'closed';
  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setView((v) => (v === 'reasons' || v === 'unavailable' ? 'closed' : v));
      button.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [panelOpen]);

  if (!visible || !space) return null;

  const bounds = fabBounds(window.innerHeight, { desktop: isDesktop(), cart: isCart });
  const side = saved?.side ?? 'right';
  // En el Carrito a 320×568 la parte baja la ocupan la tarjeta de la mesa y el botón de pagar;
  // sin posición guardada, la campana arranca arriba junto al título (QA-064).
  const top = live ? live.top : clampY(saved?.y ?? (isCart ? bounds.top : bounds.bottom), bounds);
  const left = live
    ? `${live.left}px`
    : side === 'left'
      ? `calc(var(--fcw-inset-left, 0px) + ${FAB_MARGIN}px + env(safe-area-inset-left, 0px))`
      : undefined;
  const right = !live && side === 'right' ? `calc(${FAB_MARGIN}px + env(safe-area-inset-right, 0px))` : undefined;
  const opensUp = top > 300;

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: rect.left,
      originTop: rect.top,
      moved: false,
    };
    suppressClick.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== event.pointerId) return;
    const dx = event.clientX - d.startX;
    const dy = event.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < TAP_SLOP) return;
    d.moved = true;
    setView((v) => (v === 'reasons' ? 'closed' : v));
    setLive({
      left: Math.min(window.innerWidth - (event.currentTarget.offsetWidth || FAB_SIZE), Math.max(sidebarInset(), d.originLeft + dx)),
      top: clampY(d.originTop + dy, bounds),
    });
  }

  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== event.pointerId) return;
    drag.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (!d.moved) return;
    suppressClick.current = true;
    const next: FabPosition = {
      side: snapSide(d.originLeft + event.clientX - d.startX, event.currentTarget.offsetWidth || FAB_SIZE, window.innerWidth),
      y: clampY(d.originTop + (event.clientY - d.startY), bounds),
    };
    setSaved(next);
    setLive(null);
    writeFabPosition(next);
  }

  function onPointerCancel() {
    drag.current = null;
    setLive(null);
  }

  // Teclado y toque llegan aquí; un arrastre recién soltado no abre el menú.
  function onClick() {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setView((v) => (v === 'closed' ? (call ? 'open' : 'reasons') : 'closed'));
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const step = event.key === 'ArrowUp' ? -24 : event.key === 'ArrowDown' ? 24 : 0;
    const sideKey = event.key === 'ArrowLeft' ? 'left' : event.key === 'ArrowRight' ? 'right' : null;
    if (!step && !sideKey) return;
    event.preventDefault();
    const next: FabPosition = { side: sideKey ?? side, y: clampY(top + step, bounds) };
    setSaved(next);
    writeFabPosition(next);
  }

  async function send(reason: CallReason) {
    if (!client) {
      setError('Estamos conectando tu sesión. Intenta de nuevo en unos segundos.');
      return;
    }
    if (sending.current || cooldown > 0) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    setNeedsJoin(false);
    try {
      const next = await client.call(espacioId, reason, null);
      callRef.current = next;
      setCall(next);
      setView('open');
      navigator.vibrate?.(20);
    } catch (cause) {
      if (cause instanceof CallsUnavailableError) setView('unavailable');
      else if (cause instanceof VaiinillaApiError && cause.status === 429) {
        setView('closed');
        setCooldown(cause.retryAfter ?? CALL_COOLDOWN_S);
      } else if (cause instanceof VaiinillaApiError && cause.status === 403 && cause.code === 'NO_ACTIVE_ORDER_IN_SPACE') {
        setNeedsJoin(true);
        setError('Para llamar al mesero, primero únete a la mesa.');
      } else setError(errorMessage(cause));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  async function cancel() {
    if (!client || !call) return;
    setBusy(true);
    try {
      await client.cancel(call);
      callRef.current = null;
      setCall(null);
      setView('closed');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  const going = call?.estado === 'en_camino';
  const label = call
    ? going
      ? 'Llamar al mesero. Tu mesero va en camino. Ver estado de la llamada'
      : 'Llamar al mesero. Llamando a tu mesero. Ver estado de la llamada'
    : cooldown > 0
      ? `Llamar al mesero. Podrás volver a llamar en ${cooldown} segundos`
      : 'Llamar al mesero';

  return (
    <div
      className={`alumno-fcw${isCart || collapsed ? ' is-collapsed' : ''} is-${side}${opensUp ? ' is-up' : ' is-down'}${live ? ' is-dragging' : ''}${
        call ? (going ? ' is-going' : ' is-calling') : ''
      }${isCart ? ' is-cart' : ''}`}
      style={{ left, right, '--fcw-y': `${top}px` } as CSSProperties}
      data-testid="floating-call"
    >
      <button
        ref={button}
        type="button"
        className="alumno-fcw__fab"
        aria-label={label}
        aria-expanded={panelOpen}
        aria-controls={panelId}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClick={onClick}
        onKeyDown={onKeyDown}
      >
        <BellIcon />
        <span className="alumno-fcw__label alumno-fcw__label--short" aria-hidden="true">Mesero</span>
        <span className="alumno-fcw__label alumno-fcw__label--full" aria-hidden="true">Llamar al mesero</span>
      </button>
      {/* Non-modal disclosure-style dialog: the page stays usable; Escape returns focus. */}
      <div id={panelId} role="dialog"
        aria-labelledby={view === 'reasons' ? headingId : undefined}
        aria-label={view === 'reasons' ? undefined : 'Llamar al mesero'} className="alumno-fcw__panel" hidden={!panelOpen || Boolean(live)}>
        {view === 'reasons' ? <p id={headingId}>¿Qué necesitas?</p> : null}
        {view === 'unavailable' ? (
          <p className="alumno-callwaiter__note">
            Llamar al mesero todavía no está disponible en esta cafetería.
          </p>
        ) : view === 'open' && call ? (
          <div className="alumno-fcw__live" role="status" aria-live="polite">
            <strong>
              {going
                ? `${call.tomada_por?.nombre ?? 'Tu mesero'} va en camino`
                : 'Llamando a tu mesero…'}
            </strong>
            <span>
              {going
                ? `A ${call.espacio.nombre}`
                : `${call.espacio.nombre} · ${CALL_REASONS.find((r) => r.value === call.motivo)?.label ?? ''}`}
            </span>
            {!going ? (
              <button type="button" className="alumno-callwaiter__cancel" onClick={() => void cancel()} disabled={busy}>
                Cancelar llamada
              </button>
            ) : null}
          </div>
        ) : view === 'reasons' ? (
          <div className="alumno-callwaiter__reasons">
            {cooldown > 0 ? (
              <span ref={cooldownText} tabIndex={-1} className="alumno-muted">Puedes volver a llamar en {cooldown} s</span>
            ) : (
              CALL_REASONS.filter((reason) => reason.value !== 'cuenta' || space.pagaAlFinal).map((reason, index) => (
                <button ref={index === 0 ? firstOption : undefined} key={reason.value} type="button" onClick={() => void send(reason.value)} disabled={busy}>
                  {reason.label}
                </button>
              ))
            )}
            <button type="button" className="alumno-callwaiter__back" onClick={() => setView('closed')}>
              Cancelar
            </button>
          </div>
        ) : null}
        {error ? <p className="alumno-error" role="alert">{error}{needsJoin && space.qrToken ? (
          <> <Link to={`/${space.slug}/m/${space.qrToken}/quien`}>Unirme a la mesa</Link></>
        ) : null}</p> : null}
      </div>
    </div>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 3.5a2 2 0 0 0 4 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
