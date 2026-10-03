// "Tus pedidos" sin cuenta: en vivo con la llave del navegador (localStorage),
// la misma que se guardó al pedir. No necesita la sesión de cliente (que vivía en
// sessionStorage y moría al cerrar la pestaña): cada consulta lleva la llave y el
// negocio, y el servidor devuelve los pedidos con seguimiento en vivo.
// Contrato: vaiinilla_back docs/compra-sin-cuenta.md.
import { useEffect, useState } from 'react';
import { useAuth } from '../context/auth-context';
import { api } from './api';
import { errorMessage, VaiinillaApiError } from './api-error';
import { forgetGuest, readGuest } from './guest-session';
import { isActiveOrder } from './order-labels';
import type { TrackedOrder } from '../types/api';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // La llave identifica al invitado en este dispositivo; sin ella solo quedan
  // los enlaces de seguimiento guardados (otro dispositivo o datos borrados).
  const llave = !ready || user ? null : (readGuest()?.llave ?? null);

  useEffect(() => {
    if (!llave || !slug) {
      setOrders([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    const load = async (silent = false) => {
      try {
        const next = await api.listGuestOrders(slug, llave);
        if (!active) return;
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
    void load();
    const timer = window.setInterval(() => {
      void load(true);
    }, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [llave, slug]);

  return { orders, loading, error };
}
