/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { STAFF_APP_URL } from '../types/api';
import { useAuth } from '../context/auth-context';
import { useCart } from '../context/cart-context';
import { buyerEntryPath, markBuyerExplore } from '../lib/buyer-entry';
import { StoreBadges } from './store-badges';

export function SkipLink() {
  return (
    <a className="skip-link" href="#main-content">
      Saltar al contenido
    </a>
  );
}

export function BuyerEntryLink({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const { cart } = useCart();
  const [to, setTo] = useState('/pedir');

  useEffect(() => {
    setTo(buyerEntryPath(cart?.slug));
  }, [cart?.slug]);

  return (
    <Link className={className} to={to} onClick={markBuyerExplore}>
      {children}
    </Link>
  );
}

export function SiteNav({ marketing = false }: { marketing?: boolean }) {
  const location = useLocation();
  const { user } = useAuth();
  const { cart } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const count = cart?.lines.reduce((sum, line) => sum + line.quantity, 0) ?? 0;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const logoHref = marketing ? `${location.pathname}#top` : '/';

  return (
    <header className={scrolled ? 'nav is-scrolled' : 'nav'} data-nav>
      <div className="container nav__inner">
        <Link className="nav__logo" to={logoHref} aria-label="Vaiinilla - inicio">
          <img src="/brand/vaiinilla-mark.webp" alt="" width="42" height="42" />
          <span translate="no">Vaiinilla</span>
        </Link>
        {marketing ? (
          <nav className="nav__links" aria-label="Navegación principal">
            <a href="#como-funciona">Cómo pedir</a>
            <a href="#apps">Apps</a>
            <a href="#para-establecimientos">Para negocios</a>
          </nav>
        ) : (
          <nav className="nav__links" aria-label="Navegación principal">
            <NavLink to="/pedir">Lugares</NavLink>
            <NavLink to="/cuenta">Cuenta</NavLink>
            <NavLink to="/soporte">Soporte</NavLink>
          </nav>
        )}
        <div className="nav__actions">
          {count > 0 && cart ? (
            <Link className="nav__quiet" to={`/e/${cart.slug}/carrito`}>
              Carrito ({count})
            </Link>
          ) : null}
          {marketing ? <StoreBadges compact className="nav__stores" /> : null}
          <BuyerEntryLink className="btn btn--primary nav__cta">Pedir</BuyerEntryLink>
          <Link
            className="nav__account"
            to="/cuenta"
            aria-label={user ? 'Mi cuenta' : 'Ya tengo cuenta'}
          >
            <span className="nav__account-full">{user ? 'Mi cuenta' : 'Ya tengo cuenta'}</span>
            <span className="nav__account-short">Cuenta</span>
          </Link>
          <a
            className="nav__staff"
            href={STAFF_APP_URL}
            target="_blank"
            rel="noreferrer"
          >
            Soy establecimiento <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <Link className="footer__logo" to="/" aria-label="Vaiinilla - inicio">
          <img src="/brand/vaiinilla-mark.webp" alt="" width="42" height="42" />
          <span translate="no">Vaiinilla</span>
        </Link>
        <p className="footer__tag">Menú, pedidos y retiro para cualquier negocio de comida. Apps nativas, próximamente.</p>
        <nav className="footer__links" aria-label="Pie de página">
          <BuyerEntryLink className="footer__app">Pedir</BuyerEntryLink>
          <Link className="footer__app" to="/soporte">
            Soporte
          </Link>
          <a className="footer__app" href={STAFF_APP_URL} target="_blank" rel="noreferrer">
            Soy establecimiento ↗
          </a>
        </nav>
      </div>
    </footer>
  );
}

export function PageShell({
  children,
  marketing = false,
}: {
  children: ReactNode;
  marketing?: boolean;
}) {
  return (
    <>
      <SkipLink />
      <SiteNav marketing={marketing} />
      {children}
      <SiteFooter />
    </>
  );
}

export function useReveal() {
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduceMotion.matches) {
      document.querySelectorAll('[data-reveal]').forEach((element) => element.classList.add('is-in'));
      return;
    }
    document.body.classList.add('reveal-ready');
    const observer = new IntersectionObserver(
      (entries, currentObserver) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          currentObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    document.querySelectorAll('[data-reveal]').forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);
}
