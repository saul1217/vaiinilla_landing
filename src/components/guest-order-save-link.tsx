// "Guarda este enlace" para Mis pedidos sin cuenta: el mismo respaldo que la
// página de seguimiento (otro dispositivo o si borra los datos), pero junto a la
// tarjeta en vivo. Un bloque por pedido con enlace.
import { useState } from 'react';
import { trackingUrl } from '../lib/guest-orders';

export function GuestOrderSaveLink({ token, folio }: { token: string; folio?: number }) {
  const [copied, setCopied] = useState(false);
  const link = trackingUrl(token);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Copia tu enlace:', link);
    }
  }

  async function share() {
    try {
      await navigator.share({ title: `Mi pedido${folio ? ` #${folio}` : ''}`, url: link });
    } catch {
      // Cancelado o no disponible: queda copiar.
    }
  }

  return (
    <section className="alumno-tracking__keep" role="note" aria-label="Guarda este enlace">
      <strong>Guarda este enlace</strong>
      <p>
        Tu pedido también vive en este navegador, en esta pestaña. Guarda el enlace como
        respaldo para otro dispositivo o si borras los datos: pediste sin cuenta, así que no
        te llegará por correo.
      </p>
      <code className="alumno-tracking__link">{link}</code>
      <div className="alumno-tracking__actions">
        <button type="button" className="alumno-btn alumno-btn--lime" onClick={() => void copy()}>
          {copied ? 'Enlace copiado' : 'Copiar enlace'}
        </button>
        {canShare ? (
          <button type="button" className="alumno-btn" onClick={() => void share()}>
            Compartir
          </button>
        ) : null}
      </div>
    </section>
  );
}
