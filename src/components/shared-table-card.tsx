import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { api } from '../lib/api';
import { errorMessage, VaiinillaApiError } from '../lib/api-error';
import { formatAmount } from '../lib/money';
import { orderedGroups, tableGroupKey, tableOrderState, tablePersonKey } from '../lib/shared-table';
import { dropTableParticipantOnSessionChange, forgetTableParticipant, readTableParticipant, rememberTableParticipant } from '../lib/table-participant';
import { forgetSpace, readSpace, rememberSpace, scannedSpace } from '../lib/space-session';
import { spaceNoun } from '../lib/space-words';
import type { SharedTable } from '../types/api';

const POLL_MS = 5000;
const ALIAS_MAX = 30;

function isUnauthorized(cause: unknown): boolean {
  return cause instanceof VaiinillaApiError && cause.status === 401;
}

/**
 * La mesa compartida: quién está, los pedidos de cada quien y la cuenta de todos.
 * Sin mesa, invita a unirse con un alias si el cliente llegó por el QR de una mesa.
 * Con `onEnsureToken`, un invitado sin sesión se une igual: el alias le da la sesión.
 */
export function SharedTableCard({
  accessToken,
  qrToken,
  defaultAlias,
  legalNote,
  onEnsureToken,
  onUnauthorized,
  onLeave,
  slug,
  onActiveTableChange,
  onSessionEnded,
}: {
  accessToken: string | null;
  qrToken: string | null;
  defaultAlias?: string;
  legalNote?: ReactNode;
  onEnsureToken?: (alias: string) => Promise<string>;
  onUnauthorized?: () => void;
  onLeave?: () => void;
  slug?: string;
  onActiveTableChange?: (table: SharedTable | null) => void;
  onSessionEnded?: (session: { espacioId: number; sesionId: string }) => void;
}) {
  const [table, setTable] = useState<SharedTable | null>(null);
  const [alias, setAlias] = useState(defaultAlias ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // La sesión que el invitado aseguró al unirse; el padre la confirma con accessToken.
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const lastTable = useRef<SharedTable | null>(null);
  const tableMutationVersion = useRef(0);
  const callbacks = useRef({ onActiveTableChange, onSessionEnded, onUnauthorized });
  callbacks.current = { onActiveTableChange, onSessionEnded, onUnauthorized };
  const token = accessToken ?? sessionToken;

  const rememberParticipant = useCallback((table: SharedTable) => {
    if (!slug) return;
    const space = readSpace(slug);
    if (space?.espacioId !== table.espacio.id) {
      rememberSpace({ slug, espacioId: table.espacio.id, nombre: table.espacio.nombre, tipo: table.espacio.tipo });
    }
    if (!table.mi_participante?.id) return;
    rememberTableParticipant({
      slug,
      espacioId: table.espacio.id,
      sesionId: table.sesion_id,
      participanteId: table.mi_participante.id,
      alias: table.mi_participante.alias,
    });
  }, [slug]);

  useEffect(() => {
    if (!alias && defaultAlias) setAlias(defaultAlias);
  }, [alias, defaultAlias]);

  const refresh = useCallback(async () => {
    if (!token) return;
    const requestVersion = tableMutationVersion.current;
    try {
      const next = await api.currentTable(token);
      if (requestVersion !== tableMutationVersion.current) return;
      // La sesión cambió (mesa cerrada / nueva sesión): la identidad local ya no vale.
      const previousParticipant = readTableParticipant();
      if (
        next &&
        previousParticipant &&
        previousParticipant.sesionId !== next.sesion_id
      ) {
        callbacks.current.onSessionEnded?.({ espacioId: previousParticipant.espacioId, sesionId: previousParticipant.sesionId });
      }
      dropTableParticipantOnSessionChange(next?.sesion_id ?? null);
      if (!next) {
        const staleParticipant = readTableParticipant();
        const previousTable = lastTable.current;
        const endedSpaceId = staleParticipant?.espacioId ?? previousTable?.espacio.id;
        const endedSessionId = staleParticipant?.sesionId ?? previousTable?.sesion_id;
        if (staleParticipant && staleParticipant.sesionId === endedSessionId) {
          forgetTableParticipant();
          const space = readSpace(staleParticipant.slug);
          if (space?.espacioId === staleParticipant.espacioId) forgetSpace();
        }
        if (previousTable && endedSpaceId === previousTable.espacio.id) {
          const space = scannedSpace();
          if (space?.espacioId === previousTable.espacio.id) forgetSpace();
        }
        if (endedSpaceId !== undefined && endedSessionId) {
          callbacks.current.onSessionEnded?.({ espacioId: endedSpaceId, sesionId: endedSessionId });
        }
      }
      lastTable.current = next;
      if (next) rememberParticipant(next);
      setTable(next);
      callbacks.current.onActiveTableChange?.(next);
    } catch (cause) {
      // Una consulta fallida no borra la mesa que ya se ve; la siguiente lo intenta otra vez.
      if (isUnauthorized(cause)) callbacks.current.onUnauthorized?.();
    }
  }, [rememberParticipant, token]);

  useEffect(() => {
    if (!token) {
      callbacks.current.onActiveTableChange?.(null);
      return;
    }
    void refresh();
    // Solo consulta mientras la pestaña está a la vista.
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh, token]);

  async function join(event: FormEvent) {
    event.preventDefault();
    if (!qrToken) return;
    const clean = alias.trim();
    if (!clean) return;
    setBusy(true);
    setError(null);
    tableMutationVersion.current += 1;
    try {
      const next = token ?? (onEnsureToken ? await onEnsureToken(clean) : null);
      if (!next) return;
      setSessionToken(next);
      const joined = await api.joinTable(next, qrToken, clean);
      tableMutationVersion.current += 1;
      rememberParticipant(joined);
      setTable(joined);
      callbacks.current.onActiveTableChange?.(joined);
    } catch (cause) {
      if (isUnauthorized(cause)) callbacks.current.onUnauthorized?.();
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function claim(folio: number, payIt: boolean) {
    if (!token) return;
    setBusy(true);
    setError(null);
    tableMutationVersion.current += 1;
    try {
      const updated = await api.claimTableOrder(token, folio, payIt);
      tableMutationVersion.current += 1;
      rememberParticipant(updated);
      setTable(updated);
      callbacks.current.onActiveTableChange?.(updated);
    } catch (cause) {
      if (isUnauthorized(cause)) callbacks.current.onUnauthorized?.();
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    forgetSpace();
    if (token) {
      tableMutationVersion.current += 1;
      setBusy(true);
      try {
        await api.leaveTable(token);
        tableMutationVersion.current += 1;
        forgetTableParticipant();
        setTable(null);
        callbacks.current.onActiveTableChange?.(null);
        onLeave?.();
      } catch (cause) {
        if (isUnauthorized(cause)) callbacks.current.onUnauthorized?.();
        setError(errorMessage(cause));
      } finally {
        setBusy(false);
      }
    } else {
      setTable(null);
      onLeave?.();
    }
  }

  if (!table) {
    if (!qrToken || (!token && !onEnsureToken)) return null;
    return (
      <form className="alumno-track-card shared-table alumno-arrive" onSubmit={join}>
        <header className="alumno-track-card__top">
          <span className="alumno-track-card__folio">Mesa compartida</span>
        </header>
        <div className="alumno-track-card__copy">
          <strong>¿Compartes la mesa?</strong>
          <p className="alumno-track-card__status">
            Únete con un nombre para ver los pedidos de todos y la cuenta de la mesa. Los demás solo ven ese nombre.
          </p>
        </div>
        <label className="alumno-field shared-table__field">
          <span>Tu nombre en la mesa</span>
          <input
            name="alias"
            value={alias}
            maxLength={ALIAS_MAX}
            autoComplete="nickname"
            onChange={(event) => setAlias(event.target.value)}
            placeholder="Ana"
          />
        </label>
        {error ? <p className="alumno-error">{error}</p> : null}
        <button className="alumno-btn alumno-btn--lime" type="submit" disabled={busy || !alias.trim()}>
          Unirme a la mesa
        </button>
        {legalNote}
      </form>
    );
  }

  if (!token) return null;

  const noun = spaceNoun(table.espacio.tipo);
  const people = table.participantes.length;
  return (
    <article className="alumno-track-card shared-table alumno-arrive" aria-labelledby="shared-table-title">
      <header className="alumno-track-card__top">
        <span className="alumno-track-card__folio" id="shared-table-title">{table.espacio.nombre}</span>
        <span className="alumno-track-card__pill">{people === 1 ? `Solo tú` : `${people} personas`}</span>
      </header>

      <div className="alumno-chips shared-table__people" aria-label={`Quién está en la ${noun}`}>
        {table.participantes.map((person, index) => (
          <span key={tablePersonKey(person, index)} className={person.soy_yo ? 'alumno-chip is-on' : 'alumno-chip'}>
            {person.soy_yo ? `${person.alias} (tú)` : person.alias}
          </span>
        ))}
      </div>

      {!table.cuenta_abierta || table.grupos.every((group) => group.pedidos.length === 0) ? (
        <p className="alumno-track-card__status">Aún no hay pedidos en la cuenta de la {noun}.</p>
      ) : (
        orderedGroups(table)
          .filter((group) => group.pedidos.length > 0)
          .map((group, index) => (
            <section key={tableGroupKey(group, index)} className="shared-table__group" style={{ ['--i' as string]: index }}>
              <h3 className="alumno-section-label">
                {group.soy_yo ? 'Tus pedidos' : (group.alias ?? `Otros en la ${noun}`)}
              </h3>
              <ul className="alumno-ticket-items">
                {group.pedidos.map((order) => (
                  <li key={`${order.folio}-${order.creado_en ?? ''}`}>
                    <span className="alumno-track-card__copy">
                      <strong>{order.items_resumen || `Pedido #${order.folio}`}</strong>
                      <span className="shared-table__state">{tableOrderState(order)}</span>
                    </span>
                    <span className="shared-table__right">
                      <span className="alumno-track-card__price">{formatAmount(order.total)}</span>
                      {order.pendiente_cobro ? (
                        order.pagara && !order.lo_pago_yo ? (
                          <span className="shared-table__state">Paga {order.pagara}</span>
                        ) : (
                          <button
                            type="button"
                            className={order.lo_pago_yo ? 'alumno-chip is-on' : 'alumno-chip'}
                            aria-pressed={order.lo_pago_yo === true}
                            disabled={busy}
                            onClick={() => void claim(order.folio, !order.lo_pago_yo)}
                          >
                            {order.lo_pago_yo ? 'Lo pago yo ✓' : 'Esto lo pago yo'}
                          </button>
                        )
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))
      )}

      <ul className="alumno-ticket-items shared-table__sums">
        <li>
          <span>Pagado</span>
          <span>{formatAmount(table.totales.pagado)}</span>
        </li>
        <li>
          <span>Por pagar de la {noun}</span>
          <span>{formatAmount(table.totales.pendiente)}</span>
        </li>
        <li className="shared-table__mine">
          <strong>Tu parte por pagar</strong>
          <strong className="alumno-track-card__price">{formatAmount(table.mi_parte.pendiente)}</strong>
        </li>
      </ul>

      {error ? <p className="alumno-error">{error}</p> : null}
      <button className="alumno-btn alumno-btn--ghost shared-table__leave" type="button" onClick={() => void leave()} disabled={busy}>
        Salir de la {noun}
      </button>
    </article>
  );
}
