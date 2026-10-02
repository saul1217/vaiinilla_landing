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
      <form className="alumno-card shared-table shared-table--join alumno-arrive" onSubmit={join}>
        <h2>¿Compartes la mesa?</h2>
        <p className="alumno-muted">
          Únete con un nombre para ver los pedidos de todos y la cuenta de la mesa. Los demás solo ven ese nombre.
        </p>
        <label className="shared-table__field">
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
  return (
    <section className="alumno-card shared-table alumno-arrive" aria-labelledby="shared-table-title">
      <header className="shared-table__head">
        <div>
          <h2 id="shared-table-title">{table.espacio.nombre}</h2>
          <p className="alumno-muted">
            {table.participantes.length === 1
              ? `Solo tú en la ${noun}`
              : `${table.participantes.length} personas en la ${noun}`}
          </p>
        </div>
        <span className="shared-table__total">{formatAmount(table.totales.total)}</span>
      </header>

      <ul className="shared-table__people" aria-label="Quién está">
        {table.participantes.map((person, index) => (
          <li key={`${person.alias}-${index}`} className={person.soy_yo ? 'is-me' : undefined}>
            {person.soy_yo ? `${person.alias} (tú)` : person.alias}
          </li>
        ))}
      </ul>

      {!table.cuenta_abierta || table.grupos.every((group) => group.pedidos.length === 0) ? (
        <p className="alumno-muted">Aún no hay pedidos en la cuenta de la {noun}.</p>
      ) : (
        <div className="shared-table__groups">
          {orderedGroups(table)
            .filter((group) => group.pedidos.length > 0)
            .map((group, index) => (
              <div key={`${group.alias ?? 'otros'}-${index}`} className="shared-table__group" style={{ ['--i' as string]: index }}>
                <h3>
                  {group.soy_yo ? 'Tus pedidos' : (group.alias ?? `Otros en la ${noun}`)}
                  <span>{formatAmount(group.total)}</span>
                </h3>
                <ul>
                  {group.pedidos.map((order) => (
                    <li key={`${order.folio}-${order.creado_en ?? ''}`}>
                      <span className="shared-table__items">{order.items_resumen || `Pedido #${order.folio}`}</span>
                      <span className="shared-table__state">{tableOrderState(order)}</span>
                      <span>{formatAmount(order.total)}</span>
                      {order.pendiente_cobro ? (
                        <span className="shared-table__claim">
                          {order.pagara && !order.lo_pago_yo ? (
                            <span className="shared-table__payer">Paga {order.pagara}</span>
                          ) : (
                            <button
                              type="button"
                              className={order.lo_pago_yo ? 'is-on' : undefined}
                              aria-pressed={order.lo_pago_yo === true}
                              disabled={busy}
                              onClick={() => void claim(order.folio, !order.lo_pago_yo)}
                            >
                              {order.lo_pago_yo ? 'Lo pago yo ✓' : 'Esto lo pago yo'}
                            </button>
                          )}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      )}

      <dl className="shared-table__sums">
        <div>
          <dt>Pagado</dt>
          <dd>{formatAmount(table.totales.pagado)}</dd>
        </div>
        <div>
          <dt>Por pagar</dt>
          <dd>{formatAmount(table.totales.pendiente)}</dd>
        </div>
        <div className="is-me">
          <dt>Tu parte por pagar</dt>
          <dd>{formatAmount(table.mi_parte.pendiente)}</dd>
        </div>
      </dl>

      {error ? <p className="alumno-error">{error}</p> : null}
      <button className="shared-table__leave" type="button" onClick={() => void leave()} disabled={busy}>
        Salir de la {noun}
      </button>
    </section>
  );
}
