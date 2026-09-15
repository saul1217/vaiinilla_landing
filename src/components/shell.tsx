/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { STAFF_APP_URL } from '../types/api';
import { useAuth } from '../context/auth-context';
import { useCart } from '../context/cart-context';

export function SkipLink() {
  return (
    <a className="skip-link" href="#main-content">
      Saltar al contenido
    </a>
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
        <Link className="nav__logo" to={logoHref} aria-label="Vaiinilla — inicio">
          <img src="/brand/vaiinilla-mark.webp" alt="" width="42" height="42" />
          <span translate="no">Vaiinilla</span>
        </Link>
        {marketing ? (
          <nav className="nav__links" aria-label="Navegación principal">
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#para-cafeterias">Para cafeterías</a>
            <a href="#ventajas">Qué resuelve</a>
            <NavLink to="/pedir">Pedir</NavLink>
          </nav>
        ) : (
          <nav className="nav__links" aria-label="Navegación principal">
            <NavLink to="/pedir">Cafeterías</NavLink>
            <NavLink to="/cuenta">Cuenta</NavLink>
            <NavLink to="/soporte">Soporte</NavLink>
          </nav>
        )}
        <div className="nav__actions">
          {count > 0 && cart ? (
            <Link className="btn btn--ghost nav__cta" to={`/e/${cart.slug}/carrito`}>
              Carrito ({count})
            </Link>
          ) : null}
          <Link className="btn btn--primary nav__cta" to={user ? '/cuenta' : '/cuenta'}>
            {user ? 'Mi cuenta' : 'Entrar'}
          </Link>
          <a
            className="btn btn--dark nav__cta"
            href={STAFF_APP_URL}
            target="_blank"
            rel="noreferrer"
          >
            Panel <span aria-hidden="true">↗</span>
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
        <Link className="footer__logo" to="/" aria-label="Vaiinilla — inicio">
          <img src="/brand/vaiinilla-mark.webp" alt="" width="42" height="42" />
          <span translate="no">Vaiinilla</span>
        </Link>
        <p className="footer__tag">Menú, pedidos y operación para cafeterías escolares.</p>
        <nav className="footer__links" aria-label="Pie de página">
          <Link className="footer__app" to="/pedir">
            Pedir
          </Link>
          <Link className="footer__app" to="/soporte">
            Soporte
          </Link>
          <a className="footer__app" href={STAFF_APP_URL} target="_blank" rel="noreferrer">
            Panel del establecimiento ↗
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
