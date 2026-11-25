// "Tus pedidos" sin cuenta: en vivo con la llave del navegador (localStorage),
// la misma que se guardó al pedir. No necesita la sesión de cliente (que vivía en
// sessionStorage y moría al cerrar la pestaña): cada consulta lleva la llave y el
// negocio, y el servidor devuelve los pedidos con seguimiento en vivo.
// Contrato: vaiinilla_back docs/compra-sin-cuenta.md.
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/auth-context';
import { api } from './api';
import { errorMessage, VaiinillaApiError } from './api-error';
import { isSettledOrder } from './guest-order-check';
import { forgetGuestOrderByToken } from './guest-orders';
import { forgetGuest, readGuest } from './guest-session';
import { isActiveOrder } from './order-labels';
import type { TrackedOrder } from '../types/api';
import { LIVE_SAFETY_MS, useLiveSignal, type LiveStreamRef } from './live-events';

const POLL_MS = 5000;

export interface GuestLiveOrdersState {
  orders: TrackedOrder[];
  loading: boolean;
  error: string | null;
}

/** Los pedidos en curso del invitado en esta tienda. Vacío para registrados. */
export function useGuestLiveOrders(slug: string): GuestLiveOrdersState {
  const { user, ready } = useAuth();
  const [orders, setOrders] = useState<TrackedOrder[]>([]);
  // Hasta saber si hay sesión (ready) se está cargando: el estado vacío no puede salir antes.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // La llave identifica al invitado en este dispositivo; sin ella solo quedan
  // los enlaces de seguimiento guardados (otro dispositivo o datos borrados).
  const llave = !ready || user ? null : (readGuest()?.llave ?? null);

  // Avisos en vivo por el enlace de seguimiento de cada pedido en curso: con el canal abierto se
  // relee con cada aviso y, de seguridad, cada minuto; sin canal, cada 5 s como siempre.
  const trackingKey = orders
    .map((order) => order.seguimiento_token)
    .filter((token): token is string => Boolean(token))
    .sort()
    .join(',');
  const liveRefs = useMemo<LiveStreamRef[]>(
    () => (trackingKey ? trackingKey.split(',').map((token) => ({ kind: 'seguimiento', token })) : []),
    [trackingKey],
  );
  const [signal, setSignal] = useState(0);
  const live = useLiveSignal(
    liveRefs,
    (event) => event.type === 'pedido',
    () => setSignal((n) => n + 1),
  );

  useEffect(() => {
    if (!ready) return;
    if (!llave || !slug) {
      setOrders([]);
      setLoading(false);
      return;
    }
    let active = true;
    // Una relectura por aviso (o al abrir el canal) no vuelve a mostrar "cargando".
    const quiet = signal > 0 || live;
    if (!quiet) setLoading(true);
    const load = async (silent = false) => {
      try {
        const next = await api.listGuestOrders(slug, llave);
        if (!active) return;
        for (const order of next) {
          const done = order.estado === 'entregado' || isSettledOrder(order);
          if (done && !isActiveOrder(order) && order.seguimiento_token) {
            forgetGuestOrderByToken(order.seguimiento_token);
          }
        }
        // La misma regla que /cuenta/pedidos: rentas y cuentas abiertas cuentan.
        setOrders(next.filter((order) => isActiveOrder(order)));
        setError(null);
      } catch (cause) {
        if (!active) return;
        if (cause instanceof VaiinillaApiError && cause.code === 'GUEST_KEY_INVALID') {
          // La llave ya no sirve: el próximo pedido da de alta otra identidad.
          forgetGuest();
          setOrders([]);
        } else if (!silent) {
          setError(errorMessage(cause));
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load(quiet);
    const timer = window.setInterval(() => {
      void load(true);
    }, live ? LIVE_SAFETY_MS : POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [llave, slug, ready, live, signal]);

  return { orders, loading: loading || !ready, error };
}
