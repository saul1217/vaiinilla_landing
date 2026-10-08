import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ORDER_STATUS_HINT } from '../lib/order-labels';
import { orderOperationalStatus } from '../lib/order-labels';
import {
  shouldShowPickupQr,
  shouldShowPickupSurface,
} from '../lib/pickup-qr';
import type { OrderDetail } from '../types/api';

export function OrderPickupPanel({
  order,
  token,
  stripeOrder = false,
}: {
  order: OrderDetail;
  token: string | null;
  stripeOrder?: boolean;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const showSurface = shouldShowPickupSurface(order);
  const showQr = shouldShowPickupQr(order, token);

  useEffect(() => {
    if (!showQr || !token) {
      setQr(null);
      return;
    }
    let active = true;
    void QRCode.toDataURL(token, {
      margin: 1,
      width: 280,
      color: { dark: '#1a1b19', light: '#f4f1e7' },
    }).then((next) => {
      if (active) setQr(next);
    });
    return () => {
      active = false;
    };
  }, [showQr, token]);

  if (!showSurface && !showQr) return null;

  const state = orderOperationalStatus(order);
  const listo = state === 'listo';
  const atCounter = state === 'recibido' && order.metodo_pago !== 'stripe';
  // En mesa o cancha lo lleva el mesero: el código solo se muestra si te lo pide.
  const toSpace = order.destino === 'en_espacio';
  const hint = toSpace
    ? 'Tu mesero te lo lleva. Si te pide el código, muéstrale este.'
    : listo
    ? ORDER_STATUS_HINT.listo
    : atCounter
      ? 'Muéstralo en caja o cocina para entregar.'
      : 'Muestra esto en la barra para recoger tu pedido.';
  const qrAlt = stripeOrder
    ? 'Código QR del pedido para entregar'
    : 'Código QR del pedido para mostrar en caja';

  return (
    <div
      className={listo ? 'alumno-pickup alumno-pickup--listo' : 'alumno-pickup'}
      role="region"
      aria-label="Código de retiro"
    >
      <div className="alumno-pickup__head">
        <div className="alumno-pickup__copy">
          <p className="alumno-pickup__kicker">{toSpace ? 'Código de entrega' : 'Código de retiro'}</p>
          <p className="alumno-pickup__hint">{hint}</p>
        </div>
        <p className="alumno-pickup__folio">#{order.folio}</p>
      </div>
      {qr ? (
        <div className="alumno-pickup__qr-pad">
          <img className="alumno-pickup__qr" src={qr} alt={qrAlt} />
        </div>
      ) : null}
    </div>
  );
}
