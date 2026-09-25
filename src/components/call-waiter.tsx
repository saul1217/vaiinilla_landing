// "Llamar al mesero" for an order served at a table. One tap opens three quick
// reasons; the button then morphs into a live status (calling → on the way) that
// polls every 5 s. Backend contract: docs/mesero-backend.md.
import { useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '../lib/api-error';
import { readStoredClientContext } from '../lib/client-session';
import { CALL_REASONS, CallsUnavailableError, createBuyerCallClient, type BuyerCallClient, type CallReason, type TableCall } from '../lib/mesero-api';
import { useHeightMorph } from '../lib/use-height-morph';
import type { OrderDetail } from '../types/api';

const POLL_MS = 5000;
const COOLDOWN_S = 60;

export function canCallWaiter(order: OrderDetail) {
  return order.destino === 'en_espacio' && Boolean(order.espacio) && order.estado !== 'cancelado';
}

type View = 'idle' | 'reasons' | 'open' | 'unavailable';

export function CallWaiter({ order, client: injected }: { order: OrderDetail; client?: BuyerCallClient }) {
  const client = useMemo(() => {
    if (injected) return injected;
    const token = readStoredClientContext()?.context.access_token;
    return token ? createBuyerCallClient(token) : null;
  }, [injected]);
  const espacioId = order.espacio?.id ?? 0;
  const [call, setCall] = useState<TableCall | null>(null);
  const [view, setView] = useState<View>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useHeightMorph(ref, `${view}:${call?.estado ?? ''}:${error ?? ''}`);

  // Restore an open call after a reload, then keep it fresh while open.
  useEffect(() => {
    if (!client) return;
    let active = true;
    const tick = async () => {
      try {
        const current = await client.current(espacioId);
        if (!active) return;
        setCall((prev) => {
          if (prev && !current && prev.estado !== 'cancelada') setCooldown(COOLDOWN_S);
          return current;
        });
        setView((v) => (current ? 'open' : v === 'open' ? 'idle' : v));
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

  if (!client || !canCallWaiter(order)) return null;

  async function send(reason: CallReason) {
    if (!client) return;
    setBusy(true);
    setError(null);
    try {
      const next = await client.call(espacioId, reason, order.id);
      setCall(next);
      setView('open');
      navigator.vibrate?.(20);
    } catch (cause) {
      if (cause instanceof CallsUnavailableError) setView('unavailable');
      else setError(errorMessage(cause));
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
      setView('idle');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  const going = call?.estado === 'en_camino';

  return (
    <div ref={ref} className={`alumno-callwaiter is-${view}${going ? ' is-going' : ''}`}>
      {view === 'unavailable' ? (
        <p className="alumno-callwaiter__note">Llamar al mesero todavía no está disponible en esta cafetería.</p>
      ) : view === 'open' && call ? (
        <div className="alumno-callwaiter__live" role="status" aria-live="polite">
          <span className="alumno-callwaiter__bell" aria-hidden="true">
            <BellIcon />
          </span>
          <div key={call.estado} className="alumno-callwaiter__copy">
            <strong>{going ? `${call.tomada_por?.nombre ?? 'Tu mesero'} va en camino` : 'Llamando a tu mesero…'}</strong>
            <span>{going ? `A ${call.espacio.nombre}` : `${call.espacio.nombre} · ${CALL_REASONS.find((r) => r.value === call.motivo)?.label ?? ''}`}</span>
          </div>
          {!going ? (
            <button type="button" className="alumno-callwaiter__cancel" onClick={() => void cancel()} disabled={busy}>
              Cancelar
            </button>
          ) : null}
        </div>
      ) : view === 'reasons' ? (
        <div className="alumno-callwaiter__reasons" data-morph-in>
          <p>¿Qué necesitas?</p>
          {CALL_REASONS.map((reason) => (
            <button key={reason.value} type="button" onClick={() => void send(reason.value)} disabled={busy}>
              {reason.label}
            </button>
          ))}
          <button type="button" className="alumno-callwaiter__back" onClick={() => setView('idle')}>
            Cancelar
          </button>
        </div>
      ) : (
        <button type="button" className="alumno-callwaiter__cta" onClick={() => setView('reasons')} disabled={cooldown > 0}>
          <BellIcon />
          {cooldown > 0 ? `Puedes volver a llamar en ${cooldown} s` : 'Llamar al mesero'}
        </button>
      )}
      {error ? <p className="alumno-error">{error}</p> : null}
    </div>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 3.5a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
