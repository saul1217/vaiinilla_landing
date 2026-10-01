// "Ya llegué" para un pedido para llevar en un drive-thru. El botón solo sale si el negocio dice
// que es `drive_thru` (GET /estado-operativo → tipo). Contrato: vaiinilla_back docs/ya-llegue.md.
import { useEffect, useMemo, useState } from 'react';
import { createArrivalClient, type ArrivalClient } from '../lib/arrival-api';
import { errorMessage } from '../lib/api-error';
import { readStoredClientContext } from '../lib/client-session';
import { canAnnounceArrival } from '../lib/order-labels';
import type { OrderDetail } from '../types/api';

const HOUR = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });

export function ArrivalButton({ order, client: injected }: { order: OrderDetail; client?: ArrivalClient }) {
  const client = useMemo(() => {
    if (injected) return injected;
    const token = readStoredClientContext()?.context.access_token;
    return token ? createArrivalClient(token) : null;
  }, [injected]);
  const [driveThru, setDriveThru] = useState(false);
  const [arrivedAt, setArrivedAt] = useState<string | null>(order.llegada_en ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eligible = canAnnounceArrival(order);

  useEffect(() => {
    setArrivedAt(order.llegada_en ?? null);
  }, [order.llegada_en]);

  useEffect(() => {
    if (!client || !eligible) return;
    let active = true;
    void client
      .isDriveThru()
      .then((value) => {
        if (active) setDriveThru(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [client, eligible]);

  if (!client || !eligible || !driveThru) return null;

  async function announce() {
    if (!client) return;
    setBusy(true);
    setError(null);
    try {
      const next = await client.announce(order.id);
      setArrivedAt(next.llegada_en ?? new Date().toISOString());
      navigator.vibrate?.(20);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="alumno-arrival">
      {arrivedAt ? (
        <p className="alumno-arrival__done" role="status">
          <PinIcon />
          <span>
            <strong>Avisamos que llegaste</strong>
            <span>Desde las {HOUR.format(new Date(arrivedAt))}. Cocina y Caja ya lo ven.</span>
          </span>
        </p>
      ) : (
        <button type="button" className="alumno-arrival__cta" onClick={() => void announce()} disabled={busy}>
          <PinIcon />
          {busy ? 'Avisando…' : 'Ya llegué'}
        </button>
      )}
      {error ? <p className="alumno-error">{error}</p> : null}
    </div>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Zm0-8.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
