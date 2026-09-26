import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavigationType, useLocation, useNavigationType } from 'react-router-dom';
import { applyAlumnoTheme, useTheme } from '../context/theme-context';
import { useAuth } from '../context/auth-context';
import { useCart } from '../context/cart-context';
import { lastPlaceSlug } from '../lib/last-place';
import { canAnimate, createSpring } from '../lib/spring';

// A touch of overshoot that never leaves the bar (BOUNCY overshoots ~40%).
const PILL_SPRING = { stiffness: 460, damping: 30 };
import { AlumnoLockup } from './alumno-brand';
import { UpdateToast } from './update-toast';
import { SkipLink } from './shell';

export type AlumnoTab = 'menu' | 'orders' | 'wallet' | 'cart' | 'none';

// Every page mounts its own shell, so the nav remounts on each navigation.
// These survive the remount and let the pill and the page slide from where they were.
let lastActiveTab: number | null = null;
let lastPathDepth: number | null = null;

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
    <svg viewBox="0 0 24 24" aria-hidden="true" data-nav-wallet="clipboard">
      {filled ? (
        <>
          <mask id={holeId} maskUnits="userSpaceOnUse">
            <rect width="24" height="24" fill="white" />
            <rect x="8.35" y="10.15" width="7.3" height="1.55" rx="0.55" fill="black" />
            <rect x="8.35" y="13.15" width="7.3" height="1.55" rx="0.55" fill="black" />
          </mask>
          <g mask={`url(#${holeId})`}>
            <rect x="5.85" y="5.35" width="12.3" height="14.85" rx="2.15" fill="currentColor" />
            <rect x="8.85" y="2.95" width="6.3" height="3.55" rx="1.05" fill="currentColor" />
          </g>
        </>
      ) : (
        <>
          <rect x="5.95" y="5.55" width="12.1" height="14.45" rx="2.1" {...stroke} />
          <rect x="8.95" y="3.05" width="6.1" height="3.4" rx="1" {...stroke} />
          <path {...stroke} d="M8.55 10.35h6.9M8.55 13.35h6.9" />
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

  const activeIndex = items.findIndex((item) => item.active);

  return (
    <nav className="alumno-nav" aria-label="Navegación">
      <div className="alumno-nav__brand">
        <AlumnoLockup />
      </div>
      <div className="alumno-nav__items">
        <NavPill index={activeIndex} />
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

/** One highlight shared by all tabs; it springs from the previous tab to the active one. */
function NavPill({ index }: { index: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  // Read once at mount (effects run twice under StrictMode).
  const [from] = useState(() => lastActiveTab ?? index);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || index < 0) return;
    lastActiveTab = index;
    const x = createSpring(from, PILL_SPRING);
    const unsubscribe = x.subscribe((value, velocity) => {
      const stretch = Math.min(0.28, Math.abs(velocity) / 26);
      el.style.transform = `translateX(calc(${value} * (100% + 2px))) scaleX(${1 + stretch}) scaleY(${1 - stretch * 0.4})`;
    });
    x.set(index);
    return () => {
      unsubscribe();
      x.stop();
    };
  }, [from, index]);

  if (index < 0) return null;
  return <span ref={ref} className="alumno-nav__pill" aria-hidden="true" />;
}

/** Enters the page like a native stack: deeper routes slide in, going back slides out the other way. */
function RouteStage({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const [previous] = useState(() => lastPathDepth);

  useLayoutEffect(() => {
    const el = ref.current;
    const depth = pathname.split('/').filter(Boolean).length;
    lastPathDepth = depth;
    if (!canAnimate(el) || previous === null || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const direction = navigationType === NavigationType.Pop || depth < previous ? -1 : depth > previous ? 1 : 0;
    const from = direction === 0 ? 'translate3d(0, 10px, 0)' : `translate3d(${direction * 28}px, 0, 0)`;
    const animation = el.animate(
      [
        { opacity: 0, transform: from, filter: 'blur(6px)' },
        { opacity: 1, transform: 'none', filter: 'none' },
      ],
      { duration: 380, easing: 'cubic-bezier(.16, 1, .3, 1)' },
    );
    return () => animation.cancel();
  }, [pathname, navigationType, previous]);

  return (
    <div ref={ref} className="alumno-stage">
      {children}
    </div>
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
      <UpdateToast />
      {tab === 'none' ? null : <BottomNav tab={tab} />}
      <RouteStage>{children}</RouteStage>
    </div>
  );
}
