import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { MenuPeek } from '../components/menu-peek';
import { useAuth } from '../context/auth-context';
import { useBuyerSession } from '../context/buyer-session';
import { useCart } from '../context/cart-context';
import { api } from '../lib/api';
import { lastPlaceSlug } from '../lib/last-place';
import { errorMessage } from '../lib/api-error';
import { walletQrUrl } from '../lib/env';
import { formatAmount } from '../lib/money';
import type { CatalogProduct, WalletData } from '../types/api';

export function WalletPage() {
  const { user, ready } = useAuth();
  const { cart } = useCart();
  const { context, openClientSession } = useBuyerSession();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [menuPeek, setMenuPeek] = useState<CatalogProduct[]>([]);
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

  useEffect(() => {
    if (!placeSlug) {
      setMenuPeek([]);
      return;
    }
    let active = true;
    void api
      .getGuestCatalog(placeSlug)
      .then((catalog) => {
        const products = Array.isArray(catalog?.productos) ? catalog.productos : [];
        if (active) setMenuPeek(products.filter((item) => item.disponible).slice(0, 4));
      })
      .catch(() => {
        if (active) setMenuPeek([]);
      });
    return () => {
      active = false;
    };
  }, [placeSlug]);

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
            menuPeek={menuPeek}
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
  menuPeek = [],
}: {
  saldo: string;
  placeSlug: string | null;
  reloadHref: string;
  movimientos: WalletData['movimientos'];
  menuPeek?: CatalogProduct[];
}) {
  return (
    <div className="alumno-wallet-board">
      <div className="alumno-wallet-bento">
        <section className="alumno-wallet-hero">
          <div className="alumno-wallet-orb" aria-hidden="true">
            <ShortcutWallet />
          </div>
          <p className="alumno-wallet-balance">{formatAmount(saldo, 'always')}</p>
          <p className="alumno-muted">Saldo Vaiinilla</p>
        </section>
        <div className="alumno-wallet-shortcuts">
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
        </div>
      </div>
      <div className="alumno-wallet-fill">
        {movimientos.length > 0 ? (
          <section className="alumno-wallet-rest" aria-labelledby="wallet-moves">
            <h2 className="alumno-section-label" id="wallet-moves">
              Movimientos
            </h2>
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
          </section>
        ) : null}
        <MenuPeek slug={placeSlug ?? ''} products={menuPeek} headingId="wallet-menu-peek" />
      </div>
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
        d="M6.5 3h11A1.5 1.5 0 0 1 19 4.5V21H5V4.5A1.5 1.5 0 0 1 6.5 3ZM7 5v14h10V5H7Zm2 3h6v1.6H9V8Zm0 3.2h6v1.6H9v-1.6Z"
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
        d="M12 5.1c1.5-.9 3.4-1.4 5.6-1.4.7 0 1.4.06 2 .18V18.2c-.6-.14-1.3-.22-2-.22-1.9 0-3.5.4-4.8 1.2V5.1Zm0 0C10.5 4.2 8.6 3.7 6.4 3.7c-.7 0-1.4.06-2 .18V18.2c.6-.14 1.3-.22 2-.22 1.9 0 3.5.4 4.8 1.2V5.1ZM6.4 5.3c1.8 0 3.3.4 4.4 1.1v9.7c-1.2-.6-2.7-.9-4.4-.9-.5 0-1 .04-1.4.1V5.48c.45-.12.95-.18 1.4-.18Zm11.2 0c.45 0 .95.06 1.4.18V15.3c-.4-.06-.9-.1-1.4-.1-1.7 0-3.2.3-4.4.9V6.4c1.1-.7 2.6-1.1 4.4-1.1Z"
      />
    </svg>
  );
}
