import { useEffect } from 'react';
import { STRIPE_COPY } from '../lib/stripe-status';

export type PedidoChargePhase = 'processing' | 'success';

interface PedidoChargeOverlayProps {
  phase: PedidoChargePhase;
  onDismiss?: () => void;
}

export function PedidoChargeOverlay({ phase, onDismiss }: PedidoChargeOverlayProps) {
  useEffect(() => {
    if (phase !== 'success' || !onDismiss) return;
    const timer = window.setTimeout(onDismiss, 2800);
    return () => window.clearTimeout(timer);
  }, [onDismiss, phase]);

  const processing = phase === 'processing';

  return (
    <div
      className={`alumno-charge alumno-charge--${phase}`}
      role="status"
      aria-live="assertive"
      aria-busy={processing}
    >
      <div className="alumno-charge__card">
        <div className="alumno-charge__mark" aria-hidden="true">
          {processing ? (
            <>
              <span className="alumno-charge__spinner" />
              <img src="/vaini/cutout-frente.png" alt="" />
            </>
          ) : (
            <>
              <span className="alumno-charge__burst" />
              <span className="alumno-charge__check">
                <svg viewBox="0 0 72 72">
                  <circle className="alumno-charge__ring" cx="36" cy="36" r="30" />
                  <path className="alumno-charge__tick" d="M22 37.5 31.5 47 50 26.5" />
                </svg>
              </span>
            </>
          )}
        </div>
        <h2>{processing ? STRIPE_COPY.processing : STRIPE_COPY.confirmed}</h2>
        <p className="alumno-lead">
          {processing
            ? 'Estamos cobrando tu pedido. No cierres esta pantalla.'
            : 'El cargo ya quedó. Tu pedido pasa a cocina.'}
        </p>
        {processing ? null : (
          <button className="alumno-btn alumno-btn--lime" type="button" onClick={onDismiss}>
            Ver pedido
          </button>
        )}
      </div>
    </div>
  );
}
