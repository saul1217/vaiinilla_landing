import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { errorMessage } from '../lib/api-error';
import { formatAmount } from '../lib/money';
import { ORDER_STATUS_LABEL } from '../lib/order-labels';
import { spaceNoun } from '../lib/space-words';
import type { SharedTable } from '../types/api';

const POLL_MS = 5000;
const ALIAS_MAX = 30;

/**
 * El estado de un pedido de la mesa. A la cuenta, `cobrado` solo quiere decir que
 * Cocina lo recibió: mientras no se pague, se dice que está en la cuenta.
 */
export function tableOrderState(order: SharedTable['grupos'][number]['pedidos'][number]): string {
  if (order.pendiente_cobro) return order.estado === 'cobrado' ? 'En la cuenta' : ORDER_STATUS_LABEL[order.estado];
  return `${ORDER_STATUS_LABEL[order.estado]} · pagado`;
}

/** Tus pedidos primero; luego el resto en el orden en que se unieron. */
export function orderedGroups(table: SharedTable): SharedTable['grupos'] {
  return [...table.grupos].sort((a, b) => Number(b.soy_yo) - Number(a.soy_yo));
}

/**
 * La mesa compartida: quién está, los pedidos de cada quien y la cuenta de todos.
 * Sin mesa, invita a unirse con un alias si el cliente llegó por el QR de una mesa.
 */
export function SharedTableCard({ accessToken, qrToken }: { accessToken: string | null; qrToken: string | null }) {
  const [table, setTable] = useState<SharedTable | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [alias, setAlias] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    try {
      setTable(await api.currentTable(accessToken));
    } catch {
      // Una consulta fallida no borra la mesa que ya se ve; la siguiente lo intenta otra vez.
    } finally {
      setLoaded(true);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    void refresh();
    // Solo consulta mientras la pestaña está a la vista.
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [accessToken, refresh]);

  async function join(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !qrToken) return;
    setBusy(true);
    setError(null);
    try {
      setTable(await api.joinTable(accessToken, qrToken, alias.trim()));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function claim(folio: number, payIt: boolean) {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      setTable(await api.claimTableOrder(accessToken, folio, payIt));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (!accessToken) return;
    setBusy(true);
    try {
      await api.leaveTable(accessToken);
      setTable(null);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!accessToken || !loaded) return null;

  if (!table) {
    if (!qrToken) return null;
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
      </form>
    );
  }

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
          <span key={`${person.alias}-${index}`} className={person.soy_yo ? 'alumno-chip is-on' : 'alumno-chip'}>
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
            <section key={`${group.alias ?? 'otros'}-${index}`} className="shared-table__group" style={{ ['--i' as string]: index }}>
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
