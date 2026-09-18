import { useEffect, useId, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { applyAlumnoTheme, useTheme } from '../context/theme-context';
import { useAuth } from '../context/auth-context';
import { useCart } from '../context/cart-context';
import { lastPlaceSlug } from '../lib/last-place';
import { AlumnoLockup } from './alumno-brand';
import { SkipLink } from './shell';

export type AlumnoTab = 'menu' | 'orders' | 'wallet' | 'cart' | 'none';

const stroke = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function IconMenu({ filled }: { filled: boolean }) {
  const holeId = `nav-home-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {filled ? (
        <>
          <mask id={holeId} maskUnits="userSpaceOnUse">
            <rect width="24" height="24" fill="white" />
            <rect x="10.4" y="13.05" width="3.2" height="5.55" rx="0.5" fill="black" />
          </mask>
          <path
            fill="currentColor"
            mask={`url(#${holeId})`}
            d="M12 3.15 16.6 6.75V4.4h2.9v4.55L20.6 9.95V20.8H3.4V9.95L12 3.15Z"
          />
        </>
      ) : (
        <>
          <path
            {...stroke}
            d="M4.4 10.2 12 4.3l4.5 3.5V6.15h2.55v3.95L19.6 10.2v9.45H4.4V10.2Z"
          />
          <rect x="10.2" y="13.35" width="3.6" height="4.35" rx="0.55" {...stroke} />
        </>
      )}
    </svg>
  );
}

function IconOrders({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {filled ? (
        <>
          <rect x="3.9" y="4.85" width="16.2" height="5.85" rx="1.9" fill="currentColor" />
          <rect x="3.9" y="13.3" width="16.2" height="5.85" rx="1.9" fill="currentColor" />
        </>
      ) : (
        <>
          <rect x="4.2" y="5.15" width="15.6" height="5.45" rx="1.7" {...stroke} />
          <rect x="4.2" y="13.4" width="15.6" height="5.45" rx="1.7" {...stroke} />
        </>
      )}
    </svg>
  );
}

function IconWallet({ filled }: { filled: boolean }) {
  const holeId = `nav-wallet-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {filled ? (
        <>
          <mask id={holeId} maskUnits="userSpaceOnUse">
            <rect width="24" height="24" fill="white" />
            <rect x="7.7" y="7.7" width="8.6" height="2.6" rx="0.8" fill="black" />
          </mask>
          <path
            fill="currentColor"
            mask={`url(#${holeId})`}
            d="M6.35 4.3h11.3a2.3 2.3 0 0 1 2.3 2.3v10.8a2.3 2.3 0 0 1-2.3 2.3H6.35a2.3 2.3 0 0 1-2.3-2.3V6.6a2.3 2.3 0 0 1 2.3-2.3Z"
          />
        </>
      ) : (
        <>
          <rect x="5.15" y="4.4" width="13.7" height="15.2" rx="2.35" {...stroke} />
          <rect x="7.6" y="7.7" width="8.8" height="2.55" rx="0.75" {...stroke} />
        </>
      )}
    </svg>
  );
}

function IconCart({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {filled ? (
        <path
          fill="currentColor"
          d="M3.4 3.85h2.85l.55 1.95h12.05a1.15 1.15 0 0 1 1.1 1.48l-1.55 5.05a2.05 2.05 0 0 1-1.97 1.47H9.1L8.2 16.7h10.15v1.7H7.3a1.25 1.25 0 0 1-1.21-1.52l1.22-4.38-2.35-8.3H3.4V3.85Zm5.7 14.4a1.55 1.55 0 1 1 0 3.1 1.55 1.55 0 0 1 0-3.1Zm7.4 0a1.55 1.55 0 1 1 0 3.1 1.55 1.55 0 0 1 0-3.1Z"
        />
      ) : (
        <>
          <path {...stroke} d="M3.55 4.45h2.25l2.05 7.4h8.75l1.45-5.25H7.15L5.8 4.45" />
          <circle cx="9.2" cy="18.4" r="1.35" {...stroke} />
          <circle cx="16.4" cy="18.4" r="1.35" {...stroke} />
        </>
      )}
    </svg>
  );
}

export function BottomNav({ tab }: { tab: Exclude<AlumnoTab, 'none'> }) {
  const { user } = useAuth();
  const { cart } = useCart();
  const location = useLocation();
  const placeSlug = cart?.slug ?? lastPlaceSlug();
  const count = cart?.lines.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
  const menuHref = placeSlug ? `/e/${placeSlug}` : '/pedir';
  const cartHref = placeSlug ? `/e/${placeSlug}/carrito` : '/pedir';
  const ordersHref = user ? '/cuenta/pedidos' : `/cuenta?next=/cuenta/pedidos`;
  const walletHref = user ? '/cuenta/saldo' : `/cuenta?next=/cuenta/saldo`;
  const menuActive = tab === 'menu' || location.pathname === '/pedir';

  const items = [
    { id: 'menu' as const, href: menuHref, label: 'Menú', Icon: IconMenu, active: menuActive && tab !== 'cart' },
    { id: 'orders' as const, href: ordersHref, label: 'Pedidos', Icon: IconOrders, active: tab === 'orders' },
    { id: 'wallet' as const, href: walletHref, label: 'Cartera', Icon: IconWallet, active: tab === 'wallet' },
    { id: 'cart' as const, href: cartHref, label: 'Carrito', Icon: IconCart, badge: count, active: tab === 'cart' },
  ];

  return (
    <nav className="alumno-nav" aria-label="Navegación de alumno">
      <div className="alumno-nav__brand">
        <AlumnoLockup />
      </div>
      <div className="alumno-nav__items">
        {items.map((item) => (
          <Link
            key={item.id}
            to={item.href}
            className={item.active ? 'is-on' : undefined}
            aria-current={item.active ? 'page' : undefined}
          >
            <item.Icon filled={item.active} />
            {item.badge ? <span className="alumno-badge">{item.badge}</span> : null}
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function AppShell({
  children,
  tab = 'none',
}: {
  children: ReactNode;
  tab?: AlumnoTab;
}) {
  const { resolved } = useTheme();

  useEffect(() => applyAlumnoTheme(resolved), [resolved]);

  return (
    <div className={tab === 'none' ? 'alumno' : 'alumno alumno--nav'}>
      <SkipLink />
      {tab === 'none' ? null : <BottomNav tab={tab} />}
      {children}
    </div>
  );
}
