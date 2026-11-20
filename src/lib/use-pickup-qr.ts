import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import {
  persistPickupQrFromOrder,
  rememberPickupCode,
  rememberPickupQrToken,
  resolvePickupCode,
  resolvePickupQrToken,
  shouldRecoverPickupQr,
} from './pickup-qr';
import type { OrderDetail } from '../types/api';

/** Resolve a pickup token from the order, localStorage, or GET /pedidos/:id/qr. */
export function usePickupQrToken(order: OrderDetail | null, accessToken: string | null): string | null {
  const [token, setToken] = useState<string | null>(() => (order ? resolvePickupQrToken(order) : null));
  const failedIds = useRef(new Set<string>());

  useEffect(() => {
    if (!order) {
      setToken(null);
      return;
    }

    const local = persistPickupQrFromOrder(order);
    // Un pedido de antes del código de 4 dígitos tiene el QR guardado pero no el código: se pide.
    if (local && resolvePickupCode(order)) {
      setToken(local);
      return;
    }
    if (local) setToken(local);

    if (!accessToken || !shouldRecoverPickupQr(order) || failedIds.current.has(order.id)) {
      if (!local) setToken(null);
      return;
    }

    let active = true;
    void api
      .getOrderQr(accessToken, order.id)
      .then(({ qr_token: recoveredToken, codigo_recoger: code }) => {
        if (!active || !recoveredToken?.trim()) return;
        rememberPickupCode(order.id, code);
        rememberPickupQrToken(order.id, recoveredToken);
        setToken(recoveredToken.trim());
      })
      .catch(() => {
        failedIds.current.add(order.id);
      });

    return () => {
      active = false;
    };
  }, [accessToken, order]);

  return token;
}
