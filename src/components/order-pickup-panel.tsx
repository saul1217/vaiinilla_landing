import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ORDER_STATUS_HINT } from '../lib/order-labels';
import { pickupProofs, resolvePickupCode, type PickupRules } from '../lib/pickup-qr';
import type { OrderDetail } from '../types/api';

const FILA_STATES: OrderDetail['estado'][] = ['cobrado', 'preparando', 'listo'];

export function OrderPickupPanel({
  order,
  token,
  stripeOrder = false,
  rules,
}: {
  order: OrderDetail;
  token: string | null;
  stripeOrder?: boolean;
  /** Cómo valida la entrega el negocio y si pide código al cobrar; sin ellas, QR y código. */
  rules?: PickupRules;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const proofs = pickupProofs(order, rules);
  const showSurface = proofs.surface;
  const showQr = proofs.qr !== 'hidden' && Boolean(token?.trim());

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

  // La fila se avisa desde que lo pagó: así se forma en la correcta antes de que esté listo.
  const fila =
    order.fila && FILA_STATES.includes(order.estado) && order.destino !== 'a_domicilio' ? order.fila : null;
  if (!showSurface && !showQr) {
    if (!fila) return null;
    return (
      <p className="alumno-pickup alumno-pickup__fila" role="status">
        Cuando esté listo, recógelo en <strong>{fila.nombre}</strong>
        {fila.express ? ' (express)' : ''}.
      </p>
    );
  }

  const listo = order.estado === 'listo';
  const code = showSurface && proofs.code ? resolvePickupCode(order) : null;
  const atCounter = order.estado === 'por_cobrar' && order.metodo_pago !== 'stripe';
  // En mesa o cancha lo lleva el mesero: el código solo se muestra si te lo pide.
  const toSpace = order.destino === 'en_espacio';
  const hint = toSpace
    ? listo
      ? 'Tu mesero te lo lleva.'
      : 'Tu mesero te lo lleva. Si te pide el código, muéstrale este.'
    : listo
    ? ORDER_STATUS_HINT.listo
    : atCounter
      ? 'Muéstralo en caja o cocina para entregar.'
      : 'Muestra esto en la barra para recoger tu pedido.';
  const qrAlt = stripeOrder
    ? 'Código de retiro del pedido para entregar'
    : 'Código de retiro del pedido para mostrar en caja';

  return (
    <div
      className={listo ? 'alumno-pickup alumno-pickup--listo' : 'alumno-pickup'}
      role="region"
      aria-label={`Pedido número ${order.folio}. ${toSpace ? 'Código de entrega' : 'Código de retiro'}`}
    >
      <div className="alumno-pickup__head">
        <div className="alumno-pickup__copy">
          <p className="alumno-pickup__kicker">{toSpace ? 'Código de entrega' : 'Código de retiro'}</p>
          <p className="alumno-pickup__hint">{hint}</p>
        </div>
        <p className="alumno-pickup__folio" aria-label={`Número de pedido ${order.folio}`}>#{order.folio}</p>
      </div>
      {fila ? (
        <p className="alumno-pickup__fila">
          Fórmate en <strong>{fila.nombre}</strong>
          {fila.express ? ' (express)' : ''}
        </p>
      ) : null}
      {code ? (
        <div className="alumno-pickup__code">
          <span>{proofs.qr === 'show' ? 'Si no te escanean el QR, dicta este código' : 'Dicta este código'}</span>
          <strong aria-label={`Código ${code.split('').join(' ')}`}>{code}</strong>
        </div>
      ) : null}
      {qr && proofs.qr === 'show' ? (
        <div className="alumno-pickup__qr-pad">
          <img className="alumno-pickup__qr" src={qr} alt={qrAlt} />
        </div>
      ) : null}
      {qr && proofs.qr === 'folded' ? (
        <details className="alumno-pickup__fallback">
          <summary>Si el código se bloquea, muestra este QR</summary>
          <div className="alumno-pickup__qr-pad">
            <img className="alumno-pickup__qr" src={qr} alt={qrAlt} />
          </div>
        </details>
      ) : null}
    </div>
  );
}
