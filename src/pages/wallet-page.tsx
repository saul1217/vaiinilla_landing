import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { useAuth } from '../context/auth-context';
import { useBuyerSession } from '../context/buyer-session';
import { useCart } from '../context/cart-context';
import { api } from '../lib/api';
import { lastPlaceSlug } from '../lib/last-place';
import { errorMessage } from '../lib/api-error';
import { walletQrUrl } from '../lib/env';
import { formatMoney } from '../lib/money';
import type { WalletData } from '../types/api';

export function WalletPage() {
  const { user, ready } = useAuth();
  const { cart } = useCart();
  const { context, openClientSession } = useBuyerSession();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const placeSlug = cart?.slug ?? lastPlaceSlug();

  useEffect(() => {
    if (!user) return;
    let active = true;
    const run = async () => {
      try {
        let session = context;
        if (!session && placeSlug) {
          const place = await api.getEstablishment(placeSlug);
          session = await openClientSession(user, place);
        }
        if (!session) {
          setError('Entra a una cafetería para ver el saldo de ese lugar.');
          return;
        }
        const next = await api.getMyWallet(session.access_token);
        if (active) {
          setWallet(next);
          setError(null);
        }
      } catch (cause) {
        if (active) setError(errorMessage(cause));
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [context, openClientSession, placeSlug, user]);

  if (ready && !user) return <Navigate to="/cuenta?next=/cuenta/saldo" replace />;

  return (
    <AppShell tab="wallet">
      <main id="main-content" className="alumno-main">
        <AlumnoPageHeader kicker="Cartera" title="Tu saldo" />
        {error ? <p className="alumno-error">{error}</p> : null}
        {loading && !wallet && !error ? <p role="status">Cargando saldo…</p> : null}
        {wallet ? (
          <div className="alumno-wallet-board">
            <div>
              <section className="alumno-wallet-hero">
                <p className="alumno-muted">
                  {wallet.cliente.nombre}
                  {wallet.cliente.identificador_cliente ? ` · ${wallet.cliente.identificador_cliente}` : ''}
                </p>
                <p className="alumno-wallet-balance">{formatMoney(wallet.wallet.saldo)}</p>
              </section>
              <div className="alumno-actions-3">
                <Link to={placeSlug ? `/e/${placeSlug}/carrito` : '/pedir'}>
                  <ShortcutPay />
                  Pagar
                </Link>
                <Link to="/cuenta/pedidos">
                  <ShortcutOrders />
                  Pedidos
                </Link>
                <Link to="/cuenta">
                  <ShortcutReload />
                  Recargar
                </Link>
              </div>
              <Link className="alumno-btn alumno-btn--lime" to={placeSlug ? `/e/${placeSlug}` : '/pedir'}>
                Abrir menú
              </Link>
            </div>
            <div>
              <h2 style={{ fontSize: '1rem', margin: '0 0 8px' }}>Movimientos</h2>
              {wallet.movimientos.length === 0 ? (
                <p className="alumno-muted">Todavía no hay movimientos.</p>
              ) : (
                <ul className="alumno-moves">
                  {wallet.movimientos.map((item) => (
                    <li key={item.id}>
                      <span>
                        <strong>{item.descripcion}</strong>
                        <span className="alumno-muted">{item.tipo}</span>
                      </span>
                      <strong>{formatMoney(item.monto)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}

export function WalletQrPage() {
  const { id = '' } = useParams();
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    void QRCode.toDataURL(walletQrUrl(id), { margin: 1, width: 320 }).then(setQr);
  }, [id]);

  return (
    <AppShell tab="none">
      <main id="main-content" className="alumno-main">
        <AlumnoPageHeader
          kicker="Recarga en caja"
          title="Código de alumno"
          back={{ to: '/cuenta/saldo', label: 'Volver' }}
          lead="Este enlace identifica a un alumno para recargar saldo en Caja. Si llegaste aquí por error, vuelve a tu cuenta."
        />
        <section className="alumno-card alumno-card--qr">
          {qr ? <img className="wallet-qr" src={qr} alt="Código QR de recarga" /> : null}
          <p className="alumno-muted">{walletQrUrl(id)}</p>
        </section>
        <Link className="alumno-btn alumno-btn--lime" to="/cuenta/saldo">
          Ir a mi saldo
        </Link>
      </main>
    </AppShell>
  );
}

function ShortcutPay() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v1h-2V7H6.5a.5.5 0 0 0 0 1H20v9.5A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-10Z"
      />
    </svg>
  );
}

function ShortcutOrders() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 3h10a2 2 0 0 1 2 2v15.2a.8.8 0 0 1-1.25.66L12 17.4l-5.75 3.46A.8.8 0 0 1 5 20.2V5a2 2 0 0 1 2-2Z"
      />
    </svg>
  );
}

function ShortcutReload() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 4a8 8 0 1 1-7.45 5.2l1.86.74A6 6 0 1 0 12 6v3l4-4-4-4v3Z"
      />
    </svg>
  );
}
