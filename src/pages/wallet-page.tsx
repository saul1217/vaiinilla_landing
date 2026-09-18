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
import { formatAmount } from '../lib/money';
import type { WalletData } from '../types/api';

export function WalletPage() {
  const { user, ready } = useAuth();
  const { cart } = useCart();
  const { context, openClientSession } = useBuyerSession();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const placeSlug = cart?.slug ?? lastPlaceSlug();
  const userId = wallet?.wallet.usuario_id || wallet?.cliente.usuario_id;
  const reloadHref = userId ? `/u/${userId}` : '/cuenta';

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
        <AlumnoPageHeader title="Cartera" />
        {error ? <p className="alumno-error">{error}</p> : null}
        {loading && !wallet && !error ? <p role="status">Cargando saldo…</p> : null}
        {wallet ? (
          <WalletBoardView
            saldo={wallet.wallet.saldo}
            placeSlug={placeSlug}
            reloadHref={reloadHref}
            movimientos={wallet.movimientos}
          />
        ) : null}
      </main>
    </AppShell>
  );
}

export function WalletBoardView({
  saldo,
  placeSlug,
  reloadHref,
  movimientos,
}: {
  saldo: string;
  placeSlug: string | null;
  reloadHref: string;
  movimientos: WalletData['movimientos'];
}) {
  return (
    <div className="alumno-wallet-board">
      <section className="alumno-wallet-hero">
        <div className="alumno-wallet-orb" aria-hidden="true">
          <ShortcutWallet />
        </div>
        <p className="alumno-wallet-balance">{formatAmount(saldo, 'always')}</p>
        <p className="alumno-muted">Saldo Vaiinilla</p>
      </section>
      <div className="alumno-actions-3">
        <Link to={placeSlug ? `/e/${placeSlug}/carrito` : '/pedir'}>
          <span className="alumno-lime-orb" aria-hidden="true">
            <ShortcutPay />
          </span>
          Pagar
          <span aria-hidden="true">Usar saldo</span>
        </Link>
        <Link to="/cuenta/pedidos">
          <span className="alumno-lime-orb" aria-hidden="true">
            <ShortcutOrders />
          </span>
          Pedidos
          <span aria-hidden="true">Ver actividad</span>
        </Link>
        <Link to={reloadHref}>
          <span className="alumno-lime-orb" aria-hidden="true">
            <ShortcutReload />
          </span>
          Recargar
          <span aria-hidden="true">Mostrar QR</span>
        </Link>
      </div>
      <Link className="alumno-wallet-menu" to={placeSlug ? `/e/${placeSlug}` : '/pedir'}>
        <span className="alumno-wallet-menu__icon" aria-hidden="true">
          <ShortcutMenu />
        </span>
        <span>
          <strong>Abrir menú</strong>
          <p>Usa tu saldo en tu siguiente pedido</p>
        </span>
        <span className="alumno-wallet-menu__chev" aria-hidden="true">
          →
        </span>
      </Link>
      <section
        className={movimientos.length > 0 ? 'alumno-wallet-rest' : 'alumno-wallet-rest alumno-wallet-rest--idle'}
        aria-labelledby="wallet-moves"
      >
        <h2 className="alumno-section-label" id="wallet-moves">
          Movimientos
        </h2>
        {movimientos.length > 0 ? (
          <ul className="alumno-moves">
            {movimientos.map((item) => (
              <li key={item.id}>
                <span>
                  <strong>{item.descripcion}</strong>
                  <span className="alumno-muted">{item.tipo}</span>
                </span>
                <strong>{formatAmount(item.monto, 'always')}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <div className="alumno-wallet-idle">
            <img src="/vaini/scene-laptop.png" alt="" />
            <p>Aún no hay movimientos en este lugar.</p>
          </div>
        )}
      </section>
    </div>
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

function ShortcutWallet() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v1h-2V7H6.5a.5.5 0 0 0 0 1H20v9.5A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-10Zm13.25 6.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z"
      />
    </svg>
  );
}

function ShortcutPay() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 18a1.75 1.75 0 1 0 0 3.5A1.75 1.75 0 0 0 7 18Zm10 0a1.75 1.75 0 1 0 0 3.5A1.75 1.75 0 0 0 17 18ZM3.15 4H5.4l.35 2H20a1 1 0 0 1 .98 1.22l-1.5 6.8A2 2 0 0 1 17.52 16H8.28a2 2 0 0 1-1.96-1.58L4.38 6H3.15V4Zm3.5 4 .92 5h9.9l1.1-5H6.65Z"
      />
    </svg>
  );
}

function ShortcutOrders() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 3h10a2 2 0 0 1 2 2v15.2a.8.8 0 0 1-1.25.66L12 17.4l-5.75 3.46A.8.8 0 0 1 5 20.2V5a2 2 0 0 1 2-2Zm1.5 4h7v1.6h-7V7Zm0 3.2h7v1.6h-7v-1.6Z"
      />
    </svg>
  );
}

function ShortcutReload() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 4h6v6H4V4Zm2 2v2h2V6H6Zm8-2h6v6h-6V4Zm2 2v2h2V6h-2ZM4 14h6v6H4v-6Zm2 2v2h2v-2H6Zm10-2h2v2h-2v-2Zm4 0h2v2h-2v-2Zm-4 4h2v2h-2v-2Zm4 0h2v6h-2v-2h-2v-2h2v-2Zm-4 4h2v2h-2v-2Z"
      />
    </svg>
  );
}

function ShortcutMenu() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6 3.5h11.2A2.3 2.3 0 0 1 19.5 5.8V21H8.2A2.2 2.2 0 0 0 6 23.2V3.5Zm2.2 3.2h8.2V8.4H8.2V6.7Zm0 3.3h8.2v1.6H8.2v-1.6Z"
      />
    </svg>
  );
}
