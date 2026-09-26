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
import { resolveClientSession } from '../lib/client-session';
import { lastPlaceSlug } from '../lib/last-place';
import { errorMessage } from '../lib/api-error';
import { walletQrUrl } from '../lib/env';
import { peekCatalogProducts } from '../lib/catalog-images';
import { formatAmount } from '../lib/money';
import type { CatalogProduct, WalletData } from '../types/api';
import { LoadingSkeleton } from '../components/loading-skeleton';
import { RollingNumber } from '../components/rolling-number';

export function WalletPage() {
  const { user, ready } = useAuth();
  const { cart } = useCart();
  const { context, openClientSession } = useBuyerSession();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [menuPeek, setMenuPeek] = useState<CatalogProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [placeSlug, setPlaceSlug] = useState<string | null>(() => cart?.slug ?? lastPlaceSlug());
  const userId = wallet?.wallet.usuario_id || wallet?.cliente.usuario_id;
  const reloadHref = userId ? `/u/${userId}` : '/cuenta';

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setWallet(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    const run = async () => {
      try {
        const resolved = await resolveClientSession({
          user,
          context,
          preferredSlug: cart?.slug ?? lastPlaceSlug(),
          openClientSession,
        });
        if (!resolved) {
          if (active) {
            setError('Entra a un establecimiento para ver el saldo de ese lugar.');
            setLoading(false);
          }
          return;
        }
        const next = await api.getMyWallet(resolved.context.access_token);
        if (active) {
          setPlaceSlug(resolved.slug);
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
  }, [cart?.slug, context, openClientSession, ready, user]);

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
        if (active) setMenuPeek(peekCatalogProducts(products));
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
        {loading && !wallet && !error ? <LoadingSkeleton shape="wallet" label="Cargando saldo…" /> : null}
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
          <p className="alumno-wallet-balance">
            <RollingNumber value={formatAmount(saldo, 'always')} />
          </p>
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
            <span className="alumno-wallet-menu__copy">
              <strong>Abrir menú</strong>
              <p>Usa tu saldo en tu siguiente pedido</p>
            </span>
            <span className="alumno-wallet-menu__chev" aria-hidden="true">
              <MenuChevron />
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
            <ul className="alumno-moves alumno-arrive">
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
          title="Código de recarga"
          back={{ to: '/cuenta/saldo', label: 'Volver' }}
          lead="Este enlace identifica tu cuenta para recargar saldo en Caja. Si llegaste aquí por error, vuelve a tu cuenta."
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

const shortcutStroke = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function ShortcutWallet() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" data-wallet-orb="clipboard">
      <rect x="6.2" y="5.15" width="11.6" height="15.1" rx="2.1" {...shortcutStroke} />
      <rect x="9.15" y="2.85" width="5.7" height="3.35" rx="0.95" {...shortcutStroke} />
      <path {...shortcutStroke} d="M8.55 10.15h6.9M8.55 13.05h6.9" />
    </svg>
  );
}

function ShortcutPay() {
  const mark = {
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 2.05,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" data-wallet-pay="cart">
      <path {...mark} d="M3.45 5.05h2.5l2.25 8.45h9.15l1.75-6.35H8.05" />
      <path {...mark} d="M8.05 13.5h9.15" />
      <circle cx="9.55" cy="18.2" r="1.5" {...mark} />
      <circle cx="16.95" cy="18.2" r="1.5" {...mark} />
    </svg>
  );
}

function ShortcutOrders() {
  const mark = {
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 2.05,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" data-wallet-orders="list">
      <rect x="6.35" y="4.15" width="11.3" height="15.7" rx="2.05" {...mark} />
      <path {...mark} d="M8.75 8.55h6.5M8.75 11.85h6.5M8.75 15.15h6.5" />
    </svg>
  );
}

function ShortcutReload() {
  const finder = {
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 2.45,
  };
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" data-wallet-reload="qr">
      <rect x="2.85" y="2.85" width="7.9" height="7.9" rx="1.35" {...finder} />
      <rect x="5.35" y="5.35" width="2.9" height="2.9" rx="0.4" fill="currentColor" />
      <rect x="13.25" y="2.85" width="7.9" height="7.9" rx="1.35" {...finder} />
      <rect x="15.75" y="5.35" width="2.9" height="2.9" rx="0.4" fill="currentColor" />
      <rect x="2.85" y="13.25" width="7.9" height="7.9" rx="1.35" {...finder} />
      <rect x="5.35" y="15.75" width="2.9" height="2.9" rx="0.4" fill="currentColor" />
      <rect x="13.15" y="13.15" width="2.85" height="2.85" rx="0.4" fill="currentColor" />
      <rect x="17" y="13.15" width="2.85" height="2.85" rx="0.4" fill="currentColor" />
      <rect x="13.15" y="17" width="2.85" height="2.85" rx="0.4" fill="currentColor" />
      <rect x="17" y="17" width="2.85" height="2.85" rx="0.4" fill="currentColor" />
    </svg>
  );
}

function ShortcutMenu() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" data-wallet-menu="book">
      <path
        fill="currentColor"
        d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z"
      />
    </svg>
  );
}

function MenuChevron() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" data-wallet-menu-chev="arrow">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.2 12h13.1M13.6 6.4 19.2 12l-5.6 5.6"
      />
    </svg>
  );
}
