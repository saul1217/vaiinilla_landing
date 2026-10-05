// Seguimiento de un pedido sin cuenta. Es el respaldo del invitado: su pedido vive
// en este navegador (pestaña Pedidos, igual que una cuenta); el enlace sirve para
// otro dispositivo o si borra los datos. La tarjeta se termina de pagar aquí mismo.
// Abajo, el pedido completo (estado, artículos, total y método de pago).
// Contrato: vaiinilla_back docs/compra-sin-cuenta.md.
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { OrderTrackCard } from '../components/order-track-card';
import { StripePaymentPanel } from '../components/stripe-payment-panel';
import { OrderTicketView } from './order-detail-page';
import { api } from '../lib/api';
import { errorMessage } from '../lib/api-error';
import { readGuestOrders, trackingUrl } from '../lib/guest-orders';
import { isStorageAvailable } from '../lib/storage-available';
import { isActiveOrder } from '../lib/order-labels';
import { isPermanentTrackingError, trackingRetryDelay } from '../lib/tracking-poll';
import { isStripePaymentConfirmedByBackend } from '../lib/stripe-status';
import { clearStripeCheckoutSession, peekStripeCheckoutSession } from '../lib/stripe-session';
import type { StripePaymentSession, TrackedOrder } from '../types/api';

const POLL_MS = 5000;

const POLL_PAYING_MS = 2000;

export function TrackingPage() {
  const { token = '' } = useParams();
  const [search] = useSearchParams();
  const justOrdered = search.get('nuevo') === '1';
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [stripeSession, setStripeSession] = useState<StripePaymentSession | null>(null);
  const [paying, setPaying] = useState(false);
  const saved = readGuestOrders().find((o) => o.token === token) ?? null;
  const link = trackingUrl(token);
  // QR del enlace para pasarlo a otro dispositivo sin escribirlo.
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(link, { margin: 1, width: 240 })
      .then((url) => {
        if (active) setQr(url);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [link]);
  // Sin almacenamiento (modo privado), el enlace es la única copia que existe.
  const [storageOk] = useState(isStorageAvailable);
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`Mi pedido en Vaiinilla: ${link}`)}`;

  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    let failures = 0;
    const load = async () => {
      try {
        const next = await api.getTracking(token);
        if (!active) return;
        failures = 0;
        setOrder(next);
        setError(null);
        // Se lee sin consumir: React puede montar dos veces y la sesión se perdería.
        const session = peekStripeCheckoutSession(next.id);
        if (session) setStripeSession(session);
        if (isStripePaymentConfirmedByBackend(next)) {
          setPaying(false);
          clearStripeCheckoutSession(next.id);
        }
        // Con el formulario de tarjeta a la vista no se recarga: lo vaciaría a media captura.
        const formOpen =
          next.metodo_pago === 'stripe' && next.estado === 'por_cobrar' && Boolean(session) && !paying;
        if (isActiveOrder(next) && !formOpen)
          timer = window.setTimeout(() => void load(), paying ? POLL_PAYING_MS : POLL_MS);
      } catch (cause) {
        if (!active) return;
        setError(errorMessage(cause));
        if (isPermanentTrackingError(cause)) return;
        failures += 1;
        timer = window.setTimeout(() => void load(), trackingRetryDelay(failures));
      }
    };
    void load();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [token, paying]);

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
      await navigator.share({ title: `Mi pedido #${order?.folio ?? ''}`, url: link });
    } catch {
      // Cancelado o no disponible: queda copiar.
    }
  }

  const stripePending =
    order?.metodo_pago === 'stripe' && !isStripePaymentConfirmedByBackend(order) && order.estado === 'por_cobrar';
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <AppShell tab="none">
      <main id="main-content" className="alumno-main alumno-tracking">
        <AlumnoPageHeader
          kicker={saved?.placeName ?? 'Tu pedido'}
          title={order ? `Pedido #${order.folio}` : 'Tu pedido'}
        />

        <section className="alumno-tracking__keep" role="note" aria-label="Guarda este enlace">
          <strong>{justOrdered ? '¡Listo! Guarda este enlace' : 'Guarda este enlace'}</strong>
          {storageOk ? (
            <p>
              Tu pedido también vive en este navegador, en la pestaña{' '}
              <Link to="/cuenta/pedidos">Pedidos</Link>. Guarda el enlace como respaldo para otro
              dispositivo o si borras los datos: pediste sin cuenta, así que no te llegará por
              correo.
            </p>
          ) : (
            <p>
              <strong>Este navegador no guarda datos:</strong> este enlace es tu única copia del
              pedido. Mándalo a otro lado ahora: no lo verás en la pestaña{' '}
              <Link to="/cuenta/pedidos">Pedidos</Link> al cerrar.
            </p>
          )}
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
            <a className="alumno-btn" href={whatsappHref} target="_blank" rel="noreferrer">
              Enviar por WhatsApp
            </a>
            {saved && !stripePending ? (
              <Link className="alumno-btn" to="/cuenta/pedidos">
                Ver en Mis pedidos
              </Link>
            ) : null}
          </div>
          {qr ? (
            <img className="wallet-qr" src={qr} alt="Código QR de tu enlace de seguimiento" />
          ) : null}
        </section>

        {error && !order ? <p className="alumno-error">{error}</p> : null}
        {!order && !error ? <p className="alumno-muted">Cargando tu pedido…</p> : null}

        {order && stripePending ? (
          stripeSession && !paying ? (
            <StripePaymentPanel
              order={order}
              session={stripeSession}
              onProcessing={() => setPaying(true)}
              onProcessingFailed={() => setPaying(false)}
              onConfirmed={() => setPaying(true)}
              onCanceled={() => setPaying(false)}
            />
          ) : (
            <p className="alumno-banner" role="status">
              {paying
                ? 'Confirmando tu pago con Stripe…'
                : 'Falta pagar con tarjeta. Termínalo en el dispositivo donde hiciste el pedido.'}
            </p>
          )
        ) : null}

        {order ? (
          <div className="alumno-detail-split">
            <OrderTrackCard
              order={order}
              expanded
              onToggle={() => undefined}
              toggle={false}
              completeLink={false}
              pickupToken={order.qr_token}
            />
            <OrderTicketView order={order} />
          </div>
        ) : null}

        <p className="alumno-muted alumno-tracking__account">
          ¿Quieres tener tus pedidos y tu saldo en un solo lugar?{' '}
          <Link to="/cuenta">Crea tu cuenta</Link> (opcional).
        </p>
      </main>
    </AppShell>
  );
}
