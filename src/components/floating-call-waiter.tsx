// Control fijo de "Llamar al mesero". Se monta una sola vez en la raíz de
// las rutas del cliente y aparece solo con una mesa activa. Contrato del backend:
// docs/mesero-backend.md (la llamada va a la mesa, sin pedido).
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import { errorMessage, VaiinillaApiError } from '../lib/api-error';
import { readStoredClientContext } from '../lib/client-session';
import { useFloatingCallHidden } from '../lib/floating-call';
import {
  CALL_REASONS,
  CallsUnavailableError,
  createBuyerCallClient,
  type BuyerCallClient,
  type CallReason,
  type TableCall,
} from '../lib/mesero-api';
import { scannedSpace } from '../lib/space-session';

const POLL_MS = 5000;
const COOLDOWN_S = 60;
const HIDDEN_PATHS = [/^\/$/, /^\/soporte\/?$/, /^\/u\//, /^\/seguimiento\//];

type View = 'closed' | 'reasons' | 'open' | 'unavailable';

export function FloatingCallWaiter({ client: injected }: { client?: BuyerCallClient }) {
  const { pathname } = useLocation();
  const hidden = useFloatingCallHidden();
  const panelId = useId();
  const [space, setSpace] = useState(() => scannedSpace());
  const [view, setView] = useState<View>('closed');
  const [call, setCall] = useState<TableCall | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [, setViewport] = useState(0);
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

  // Recupera una llamada abierta tras recargar y la mantiene al día.
  useEffect(() => {
    if (!client || !espacioId) return;
    let active = true;
    const tick = async () => {
      setSpace(scannedSpace());
      try {
        const current = await client.current(espacioId);
        if (!active) return;
        setCall((prev) => {
          if (prev && !current && prev.estado !== 'cancelada') setCooldown(COOLDOWN_S);
          return current;
        });
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

  const side = 'left';
  const opensUp = true;

  // El control es fijo: cualquier clic, incluso después de mover el dedo, abre el panel.
  function onClick() {
    setView((v) => (v === 'closed' ? (call ? 'open' : 'reasons') : 'closed'));
  }

  async function send(reason: CallReason) {
    if (!client) {
      setError('Estamos preparando la llamada. Intenta de nuevo en unos segundos.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await client.call(espacioId, reason, null);
      setCall(next);
      setView('open');
      navigator.vibrate?.(20);
    } catch (cause) {
      if (cause instanceof CallsUnavailableError) setView('unavailable');
      else if (cause instanceof VaiinillaApiError && cause.status === 429) {
        setView('closed');
        setCooldown(cause.retryAfter ?? COOLDOWN_S);
      } else setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!client || !call) return;
    setBusy(true);
    try {
      await client.cancel(call);
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
      ? 'Tu mesero va en camino. Ver estado de la llamada'
      : 'Llamando a tu mesero. Ver estado de la llamada'
    : cooldown > 0
      ? `Llamar al mesero. Podrás volver a llamar en ${cooldown} segundos`
      : 'Llamar al mesero';

  return (
    <div
      className={`alumno-fcw is-${side}${opensUp ? ' is-up' : ' is-down'}${
        call ? (going ? ' is-going' : ' is-calling') : ''
      }${/\/carrito\/?$/.test(pathname) ? ' is-cart' : ''}`}
      data-testid="floating-call"
    >
      <button
        ref={button}
        type="button"
        className="alumno-fcw__fab"
        aria-label={label}
        aria-expanded={panelOpen}
        aria-controls={panelId}
        onClick={onClick}
      >
        <BellIcon />
        <span>Llamar al mesero</span>
      </button>
      <div id={panelId} className="alumno-fcw__panel" hidden={!panelOpen}>
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
            <p>¿Qué necesitas?</p>
            {cooldown > 0 ? (
              <span className="alumno-muted">Puedes volver a llamar en {cooldown} s</span>
            ) : (
              CALL_REASONS.filter((reason) => reason.value !== 'cuenta' || space.pagaAlFinal).map((reason) => (
                <button key={reason.value} type="button" onClick={() => void send(reason.value)} disabled={busy}>
                  {reason.label}
                </button>
              ))
            )}
            <button type="button" className="alumno-callwaiter__back" onClick={() => setView('closed')}>
              Cancelar
            </button>
          </div>
        ) : null}
        {error ? <p className="alumno-error">{error}</p> : null}
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
