// Waiter board: every table at a glance, most urgent first (calling → order ready
// → active → free). Polls every 5 s while visible; a new call chimes, vibrates and
// blinks the tab title. Tapping a table opens its sheet with the actions.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { canAnimate, prefersReducedMotion } from '../lib/spring';
import { errorMessage } from '../lib/api-error';
import { ORDER_STATUS_LABEL } from '../lib/order-labels';
import { CALL_REASONS, type Board, type BoardOrder, type BoardTable, type TableCall, type WaiterClient } from '../lib/mesero-api';
import { MotionSheet } from './motion-sheet';
import { DeliverSheet } from './deliver-sheet';

const POLL_MS = 5000;

type TableState = 'call' | 'ready' | 'active' | 'free';

const STATE_RANK: Record<TableState, number> = { call: 0, ready: 1, active: 2, free: 3 };

function stateOf(table: BoardTable): TableState {
  if (table.llamada) return 'call';
  if (table.pedidos.some((order) => order.estado === 'listo')) return 'ready';
  if (table.pedidos.length > 0) return 'active';
  return 'free';
}

function since(iso: string, now: number) {
  const s = Math.max(0, Math.floor((now - Date.parse(iso)) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "Mesa 12" → "12"; anything else keeps its name. */
function shortName(name: string) {
  const match = name.match(/(\d+)\s*$/);
  return match ? match[1]! : name;
}

const reasonStaff = (call: TableCall) => CALL_REASONS.find((reason) => reason.value === call.motivo)?.staff ?? 'Necesita atención';

function chime() {
  try {
    const AC = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    [880, 1320].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const t = ctx.currentTime + i * 0.14;
      o.type = 'triangle';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.4);
    });
    window.setTimeout(() => void ctx.close(), 900);
  } catch {
    // audio blocked until the first tap; the blink and vibration still fire
  }
}

/** FLIP: tiles glide to their new place when the order changes. */
function useFlip(container: React.RefObject<HTMLElement | null>, key: string) {
  const last = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const next = new Map<string, DOMRect>();
    const tiles = [...el.querySelectorAll<HTMLElement>('[data-flip]')];
    for (const tile of tiles) next.set(tile.dataset.flip!, tile.getBoundingClientRect());
    if (!prefersReducedMotion()) {
      for (const tile of tiles) {
        const before = last.current.get(tile.dataset.flip!);
        const after = next.get(tile.dataset.flip!);
        if (!before || !after || !canAnimate(tile)) continue;
        const dx = before.left - after.left;
        const dy = before.top - after.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
        tile.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.16, 1, .3, 1)' });
      }
    }
    last.current = next;
  }, [container, key]);
}

export function WaiterBoard({ client, placeName, onSignOut }: { client: WaiterClient; placeName: string; onSignOut?: () => void }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [delivering, setDelivering] = useState<BoardOrder | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState<'todas' | 'atender'>('todas');
  const known = useRef<Set<string> | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const next = await client.board();
      setBoard(next);
      setError(null);
      const calls = next.tables.flatMap((table) => (table.llamada?.estado === 'pendiente' ? [table.llamada] : []));
      if (known.current) {
        const fresh = calls.filter((call) => !known.current!.has(call.id));
        if (fresh.length > 0) {
          chime();
          navigator.vibrate?.([120, 80, 120]);
          setToast(`${fresh[0]!.espacio.nombre} te llama · ${reasonStaff(fresh[0]!)}`);
        }
      }
      known.current = new Set(calls.map((call) => call.id));
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, [client]);

  useEffect(() => {
    void load();
    let timer = window.setInterval(() => void load(), POLL_MS);
    const onVisibility = () => {
      window.clearInterval(timer);
      if (!document.hidden) {
        void load();
        timer = window.setInterval(() => void load(), POLL_MS);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const tables = useMemo(() => {
    const list = [...(board?.tables ?? [])];
    list.sort((a, b) => {
      const rank = STATE_RANK[stateOf(a)] - STATE_RANK[stateOf(b)];
      if (rank !== 0) return rank;
      if (a.llamada && b.llamada) return Date.parse(a.llamada.creado_en) - Date.parse(b.llamada.creado_en);
      return a.espacio.nombre.localeCompare(b.espacio.nombre, 'es', { numeric: true });
    });
    return filter === 'atender' ? list.filter((table) => ['call', 'ready'].includes(stateOf(table))) : list;
  }, [board, filter]);

  const calling = tables.filter((table) => stateOf(table) === 'call').length;
  const pendingCalls = (board?.tables ?? []).filter((table) => table.llamada?.estado === 'pendiente').length;
  const ready = (board?.tables ?? []).reduce((sum, table) => sum + table.pedidos.filter((order) => order.estado === 'listo').length, 0);
  const active = (board?.tables ?? []).filter((table) => table.pedidos.length > 0).length;

  // Tab title blinks while someone is waiting.
  useEffect(() => {
    const base = 'Mesas · Vaiinilla';
    if (pendingCalls === 0) {
      document.title = base;
      return;
    }
    let on = false;
    const id = window.setInterval(() => {
      on = !on;
      document.title = on ? `● ${pendingCalls} ${pendingCalls === 1 ? 'mesa llama' : 'mesas llaman'}` : base;
    }, 900);
    return () => {
      window.clearInterval(id);
      document.title = base;
    };
  }, [pendingCalls]);

  useFlip(gridRef, tables.map((table) => `${table.espacio.id}:${stateOf(table)}`).join('|'));

  const open = board?.tables.find((table) => table.espacio.id === openId) ?? null;

  async function transition(call: TableCall, target: 'en_camino' | 'atendida') {
    setBusy(call.id);
    try {
      await client.transitionCall(call, target);
      setToast(target === 'en_camino' ? `Vas a ${call.espacio.nombre}` : `${call.espacio.nombre} atendida`);
      if (target === 'atendida') setOpenId(null);
    } catch (cause) {
      setToast(errorMessage(cause));
    } finally {
      setBusy(null);
      void load();
    }
  }

  return (
    <main id="main-content" className="alumno-main mesero">
      <header className="mesero__head">
        <div>
          <p className="alumno-kicker">Mesero · {placeName}</p>
          <h1>Mesas</h1>
        </div>
        <span className={error ? 'mesero__live is-off' : 'mesero__live'}>
          <i aria-hidden="true" />
          {error ? 'Sin conexión' : 'En vivo'}
        </span>
      </header>

      <div className="mesero__summary" role="status">
        <span className={calling ? 'is-call' : undefined}>
          <b>{calling}</b> llamando
        </span>
        <span className={ready ? 'is-ready' : undefined}>
          <b>{ready}</b> {ready === 1 ? 'listo' : 'listos'}
        </span>
        <span>
          <b>{active}</b> activas
        </span>
      </div>

      <div className="mesero__filter" role="tablist" aria-label="Filtro">
        <span className="mesero__filter-pill" style={{ '--i': filter === 'todas' ? 0 : 1 } as CSSProperties} aria-hidden="true" />
        <button type="button" role="tab" aria-selected={filter === 'todas'} onClick={() => setFilter('todas')}>
          Todas
        </button>
        <button type="button" role="tab" aria-selected={filter === 'atender'} onClick={() => setFilter('atender')}>
          Por atender
        </button>
      </div>

      {board && !board.callsEnabled ? (
        <p className="mesero__notice">Las llamadas de mesa todavía no están activas en el servidor. Ya ves los pedidos listos y puedes entregarlos.</p>
      ) : null}
      {error && !board ? <p className="alumno-error">{error}</p> : null}

      {!board && !error ? (
        <div className="mesero__grid" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="mesero__tile is-skeleton" />
          ))}
        </div>
      ) : (
        <div className="mesero__grid" ref={gridRef}>
          {tables.map((table) => {
            const state = stateOf(table);
            const readyOrders = table.pedidos.filter((order) => order.estado === 'listo');
            return (
              <button
                key={table.espacio.id}
                data-flip={table.espacio.id}
                type="button"
                className={`mesero__tile is-${state}${table.llamada?.estado === 'en_camino' ? ' is-going' : ''}`}
                onClick={() => setOpenId(table.espacio.id)}
                aria-label={`${table.espacio.nombre}. ${
                  state === 'call' ? 'Llamando' : state === 'ready' ? 'Pedido listo' : state === 'active' ? 'Con pedidos' : 'Libre'
                }`}
              >
                <b>{shortName(table.espacio.nombre)}</b>
                {state === 'call' && table.llamada ? (
                  <small>
                    {table.llamada.estado === 'en_camino' ? `Va ${table.llamada.tomada_por?.nombre ?? 'alguien'}` : 'Llamando'} · {since(table.llamada.creado_en, now)}
                    <br />
                    {reasonStaff(table.llamada)}
                  </small>
                ) : state === 'ready' ? (
                  <small>
                    #{readyOrders.map((order) => order.folio).join(', #')} listo
                  </small>
                ) : state === 'active' ? (
                  <small>
                    {table.pedidos.length} {table.pedidos.length === 1 ? 'pedido' : 'pedidos'}
                  </small>
                ) : (
                  <small>Libre</small>
                )}
              </button>
            );
          })}
          {tables.length === 0 ? <p className="alumno-muted mesero__empty">Nada por atender. Todo en orden.</p> : null}
        </div>
      )}

      {onSignOut ? (
        <button className="alumno-link mesero__signout" type="button" onClick={onSignOut}>
          Cambiar de cuenta
        </button>
      ) : null}

      {toast ? (
        <div key={toast} className="mesero__toast" role="status">
          {toast}
        </div>
      ) : null}

      {open ? (
        <MotionSheet className="alumno-sheet alumno-codesheet mesero-sheet" labelledBy="mesero-sheet-title" onClosed={() => setOpenId(null)}>
          {(close, dragHandle) => (
            <div className="alumno-codesheet__panel">
              <div className="alumno-codesheet__grab" {...dragHandle}>
                <span aria-hidden="true" />
              </div>
              <h2 id="mesero-sheet-title">{open.espacio.nombre}</h2>
              <p className="alumno-codesheet__lead">
                {open.pedidos.length === 0 ? 'Sin pedidos en curso' : `${open.pedidos.length} ${open.pedidos.length === 1 ? 'pedido' : 'pedidos'} en curso`}
              </p>

              {open.llamada ? (
                <section className={`mesero-call is-${open.llamada.estado}`}>
                  <div>
                    <strong>{reasonStaff(open.llamada)}</strong>
                    <p>
                      {open.llamada.cliente?.nombre ?? 'Cliente'} · hace {since(open.llamada.creado_en, now)}
                      {open.llamada.tomada_por ? ` · va ${open.llamada.tomada_por.nombre}` : ''}
                    </p>
                  </div>
                  {open.llamada.estado === 'pendiente' ? (
                    <button className="alumno-btn alumno-btn--lime" type="button" disabled={busy === open.llamada.id} onClick={() => void transition(open.llamada!, 'en_camino')}>
                      Voy
                    </button>
                  ) : (
                    <button className="alumno-btn alumno-btn--lime" type="button" disabled={busy === open.llamada.id} onClick={() => void transition(open.llamada!, 'atendida')}>
                      Atendida
                    </button>
                  )}
                </section>
              ) : null}

              <ul className="mesero-orders">
                {open.pedidos.map((order, index) => (
                  <li key={order.id} style={{ '--i': index } as CSSProperties}>
                    <div>
                      <strong>
                        #{order.folio} · {order.cliente?.nombre ?? 'Cliente'}
                      </strong>
                      <p>{order.items_resumen}</p>
                    </div>
                    {order.estado === 'listo' ? (
                      <button className="alumno-btn alumno-btn--lime" type="button" onClick={() => setDelivering(order)}>
                        Entregar
                      </button>
                    ) : (
                      <span className={`mesero-status is-${order.estado}`}>{ORDER_STATUS_LABEL[order.estado]}</span>
                    )}
                  </li>
                ))}
              </ul>
              <button className="alumno-link alumno-codesheet__cancel" type="button" onClick={close}>
                Cerrar
              </button>
            </div>
          )}
        </MotionSheet>
      ) : null}

      {delivering ? (
        <DeliverSheet
          order={delivering}
          onDeliver={async (token) => {
            await client.deliver(delivering, token);
            setToast(`#${delivering.folio} entregado`);
            void load();
          }}
          onClosed={() => setDelivering(null)}
        />
      ) : null}
    </main>
  );
}
