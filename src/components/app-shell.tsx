import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { applyAlumnoTheme, useTheme } from '../context/theme-context';
import { useAuth } from '../context/auth-context';
import { useCart } from '../context/cart-context';
import { lastPlaceSlug } from '../lib/last-place';
import { SkipLink } from './shell';

export type AlumnoTab = 'menu' | 'orders' | 'wallet' | 'cart' | 'none';

function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v3A1.5 1.5 0 0 1 18.5 11h-13A1.5 1.5 0 0 1 4 9.5v-3Zm0 8A1.5 1.5 0 0 1 5.5 13h13a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-3Z"
      />
    </svg>
  );
}

function IconOrders() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 3h10a2 2 0 0 1 2 2v15.2a.8.8 0 0 1-1.25.66L12 17.4l-5.75 3.46A.8.8 0 0 1 5 20.2V5a2 2 0 0 1 2-2Zm0 2v13.12l4.25-2.56a1.5 1.5 0 0 1 1.5 0L17 18.12V5H7Z"
      />
    </svg>
  );
}

function IconWallet() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v1h-2V7H6.5a.5.5 0 0 0 0 1H20v9.5A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-10Zm13.25 6.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z"
      />
    </svg>
  );
}

function IconCart() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 6V5a5 5 0 0 1 10 0v1h2.2a1 1 0 0 1 .98 1.2l-1.5 8A2 2 0 0 1 16.7 17H8.3a2 2 0 0 1-1.97-1.8l-1.5-8A1 1 0 0 1 5.8 6H7Zm2 0h6V5a3 3 0 0 0-6 0v1Z"
      />
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
    { id: 'menu' as const, href: menuHref, label: 'Menú', icon: <IconMenu />, active: menuActive && tab !== 'cart' },
    { id: 'orders' as const, href: ordersHref, label: 'Pedidos', icon: <IconOrders />, active: tab === 'orders' },
    { id: 'wallet' as const, href: walletHref, label: 'Cartera', icon: <IconWallet />, active: tab === 'wallet' },
    { id: 'cart' as const, href: cartHref, label: 'Carrito', icon: <IconCart />, badge: count, active: tab === 'cart' },
  ];

  return (
    <nav className="alumno-nav" aria-label="Navegación de alumno">
      <p className="alumno-nav__brand">Vaiinilla</p>
      <div className="alumno-nav__items">
        {items.map((item) => (
          <Link
            key={item.id}
            to={item.href}
            className={item.active ? 'is-on' : undefined}
            aria-current={item.active ? 'page' : undefined}
          >
            {item.icon}
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
