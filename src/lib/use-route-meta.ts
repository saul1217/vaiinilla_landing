import { useEffect, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { NOT_FOUND_META, metaForPath } from './seo';

function setAttribute(selector: string, create: () => HTMLElement, attribute: string, value: string) {
  let element = document.head.querySelector<HTMLElement>(selector);
  if (!element) {
    element = create();
    document.head.appendChild(element);
  }
  element.setAttribute(attribute, value);
}

function meta(attribute: 'name' | 'property', key: string) {
  return () => {
    const element = document.createElement('meta');
    element.setAttribute(attribute, key);
    return element;
  };
}

function addRouteNoindex() {
  if (document.head.querySelector('meta[name="robots"][data-route]')) return;
  const robots = document.createElement('meta');
  robots.name = 'robots';
  robots.content = 'noindex, nofollow';
  robots.dataset.route = '';
  document.head.appendChild(robots);
}

/**
 * Title, description, canonical, og y twitter de la ruta actual. Las rutas privadas reciben
 * noindex propio (marcado con data-route) sin tocar el noindex que el build pone fuera de producción.
 * Va en useLayoutEffect para que una página pueda ajustar el head después con useEffect
 * (useNotFoundMeta), porque los efectos del padre corren después de los del hijo.
 */
export function useRouteMeta() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    const route = metaForPath(pathname);
    document.title = route.title;
    setAttribute('meta[name="description"]', meta('name', 'description'), 'content', route.description);
    setAttribute('meta[property="og:title"]', meta('property', 'og:title'), 'content', route.title);
    setAttribute('meta[property="og:description"]', meta('property', 'og:description'), 'content', route.description);
    setAttribute('meta[property="og:url"]', meta('property', 'og:url'), 'content', route.canonical);
    setAttribute('meta[name="twitter:title"]', meta('name', 'twitter:title'), 'content', route.title);
    setAttribute('meta[name="twitter:description"]', meta('name', 'twitter:description'), 'content', route.description);
    setAttribute(
      'link[rel="canonical"]',
      () => {
        const link = document.createElement('link');
        link.rel = 'canonical';
        return link;
      },
      'href',
      route.canonical,
    );

    if (route.noindex) addRouteNoindex();
    else document.head.querySelector('meta[name="robots"][data-route]')?.remove();
  }, [pathname]);
}

/**
 * La página «No encontramos esa página»: título propio, noindex y sin canonical ni og:url, igual
 * que dist/404.html. Al navegar a otra ruta, useRouteMeta vuelve a poner los de esa ruta.
 */
export function useNotFoundMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = NOT_FOUND_META.title;
    document.head.querySelector('meta[name="description"]')?.setAttribute('content', NOT_FOUND_META.description);
    document.head.querySelector('meta[property="og:title"]')?.setAttribute('content', NOT_FOUND_META.title);
    document.head.querySelector('meta[property="og:description"]')?.setAttribute('content', NOT_FOUND_META.description);
    document.head.querySelector('meta[name="twitter:title"]')?.setAttribute('content', NOT_FOUND_META.title);
    document.head.querySelector('meta[name="twitter:description"]')?.setAttribute('content', NOT_FOUND_META.description);
    document.head.querySelector('link[rel="canonical"]')?.remove();
    document.head.querySelector('meta[property="og:url"]')?.remove();
    addRouteNoindex();
  }, [pathname]);
}
