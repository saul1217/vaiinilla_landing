import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { metaForPath } from './seo';

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

/**
 * Title, description, canonical, og y twitter de la ruta actual. Las rutas privadas reciben
 * noindex propio (marcado con data-route) sin tocar el noindex que el build pone fuera de producción.
 */
export function useRouteMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
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

    const routeRobots = document.head.querySelector('meta[name="robots"][data-route]');
    if (route.noindex && !routeRobots) {
      const robots = document.createElement('meta');
      robots.name = 'robots';
      robots.content = 'noindex, nofollow';
      robots.dataset.route = '';
      document.head.appendChild(robots);
    } else if (!route.noindex) {
      routeRobots?.remove();
    }
  }, [pathname]);
}
