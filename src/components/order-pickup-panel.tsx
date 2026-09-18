import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  isShortPickupCode,
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
    void QRCode.toDataURL(token, { margin: 1, width: 280 }).then((next) => {
      if (active) setQr(next);
    });
    return () => {
      active = false;
    };
  }, [showQr, token]);

  if (!showSurface && !showQr) return null;

  const atCounter = order.estado === 'por_cobrar' && order.metodo_pago !== 'stripe';
  const hint = atCounter
    ? 'Muéstralo en caja o cocina para entregar.'
    : 'Muestra esto en la barra para recoger tu pedido.';
  const qrAlt = stripeOrder
    ? 'Código QR del pedido para entregar'
    : 'Código QR del pedido para mostrar en caja';
  const readableCode = token && isShortPickupCode(token) ? token : null;

  return (
    <div className="alumno-pickup" role="region" aria-label="Código de retiro">
      <p className="alumno-pickup__kicker">Código de retiro</p>
      <p className="alumno-pickup__folio">#{order.folio}</p>
      {qr ? <img className="alumno-pickup__qr" src={qr} alt={qrAlt} /> : null}
      {readableCode ? <p className="alumno-pickup__code">{readableCode}</p> : null}
      <p className="alumno-pickup__hint">{hint}</p>
    </div>
  );
}
