// Metadatos SEO por ruta. Lo usan la app (useRouteMeta), el plugin de build (robots y sitemap)
// y el prerender, así que no depende de import.meta.env ni del DOM.

/** Dominio canónico: vaiinilla.app sin www; www redirige (308) al apex (vercel.json). */
export const SITE_URL = 'https://vaiinilla.app';
export const SITE_NAME = 'Vaiinilla';

export interface PageMeta {
  title: string;
  description: string;
}

export const DEFAULT_META: PageMeta = {
  title: 'Vaiinilla - Pide y recoge sin filas en Chihuahua | vaiinilla.app',
  description:
    'Pide y recoge sin filas en Chihuahua con vaiinilla.app: menú, pago y seguimiento desde el celular. Vaiinilla también es la app para negocios de comida.',
};

/** Rutas públicas fijas: van al sitemap y se prerenderizan con su propio head. */
export const PUBLIC_PAGES: Readonly<Record<string, PageMeta>> = {
  '/': DEFAULT_META,
  '/pedir': {
    title: 'Pedir y recoger sin filas - Vaiinilla',
    description:
      'Busca el restaurante o cafetería, escribe tu mesa o escanea el código, pide desde el celular y recoge sin filas en Chihuahua.',
  },
  '/soporte': {
    title: 'Soporte - Vaiinilla',
    description:
      'Ayuda con tu pedido, tu saldo, un pago o tu cuenta de Vaiinilla. Escríbenos a equipo@vaiinilla.app.',
  },
};

/** Página 404 (dist/404.html): Vercel la sirve con estado 404 a las rutas que no son de la app. */
export const NOT_FOUND_META: PageMeta = {
  title: 'Página no encontrada - Vaiinilla',
  description: 'Esta dirección no existe en vaiinilla.app. Vuelve al inicio para pedir y recoger sin filas.',
};

/** Rutas de cuenta, tokens de seguimiento y mesas: nunca se indexan. */
const PRIVATE_SECTIONS = ['/cuenta', '/acceso', '/seguimiento', '/u', '/__qa'];
const TABLE_TOKEN = /\/m\/[^/]+/;
/** Huésped de hotel: código de estancia, cuenta, solicitudes y pedido al cuarto (checkout). */
const HOTEL_GUEST = /^\/e\/[^/]+\/hotel(?:\/|$)/;

export function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

export function isPrivatePath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return (
    PRIVATE_SECTIONS.some((section) => path === section || path.startsWith(`${section}/`)) ||
    TABLE_TOKEN.test(path) ||
    HOTEL_GUEST.test(path)
  );
}

export function canonicalUrl(pathname: string): string {
  const path = normalizePath(pathname);
  return path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`;
}

export interface RouteMeta extends PageMeta {
  canonical: string;
  noindex: boolean;
}

export function metaForPath(pathname: string): RouteMeta {
  const path = normalizePath(pathname);
  return {
    ...(PUBLIC_PAGES[path] ?? DEFAULT_META),
    canonical: canonicalUrl(path),
    noindex: isPrivatePath(path),
  };
}

/** Solo un deploy de Vercel que no es producción se oculta; el build local y el de CI no. */
export function isIndexable(vercelEnv: string | undefined): boolean {
  return !vercelEnv || vercelEnv === 'production';
}

export function robotsTxt(indexable: boolean): string {
  if (!indexable) return 'User-agent: *\nDisallow: /\n';
  return [
    'User-agent: *',
    'Allow: /',
    // `$` y `/` en vez del prefijo suelto: `Disallow: /cuenta` también bloquearía /cuentas-x.
    ...PRIVATE_SECTIONS.flatMap((section) => [`Disallow: ${section}$`, `Disallow: ${section}/`]),
    'Disallow: /*/m/',
    'Disallow: /e/*/hotel$',
    'Disallow: /e/*/hotel/',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n');
}

export function sitemapXml(lastmod: string): string {
  const urls = Object.keys(PUBLIC_PAGES)
    .map((path) => `  <url>\n    <loc>${canonicalUrl(path)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Reemplaza title, description, canonical, og y twitter de un index.html por los de la ruta. */
export function applyMetaToHtml(html: string, meta: RouteMeta): string {
  const title = escapeAttribute(meta.title);
  const description = escapeAttribute(meta.description);
  const replacements: [RegExp, string][] = [
    [/<title>[^<]*<\/title>/, `<title>${title}</title>`],
    [/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${description}$2`],
    [/(<meta\s+property="og:title"\s+content=")[^"]*(")/, `$1${title}$2`],
    [/(<meta\s+property="og:description"\s+content=")[^"]*(")/, `$1${description}$2`],
    [/(<meta\s+property="og:url"\s+content=")[^"]*(")/, `$1${meta.canonical}$2`],
    [/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/, `$1${title}$2`],
    [/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/, `$1${description}$2`],
    [/(<link\s+rel="canonical"\s+href=")[^"]*(")/, `$1${meta.canonical}$2`],
  ];
  return replacements.reduce((current, [pattern, value]) => {
    if (!pattern.test(current)) throw new Error(`index.html no tiene ${pattern}`);
    return current.replace(pattern, value);
  }, html);
}

/** El shell de rutas no prerenderizadas no declara canonical ni og:url: los pone useRouteMeta. */
export function stripRouteSpecificTags(html: string): string {
  return html
    .replace(/\s*<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/, '')
    .replace(/\s*<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/, '');
}

/**
 * Head de dist/404.html: título propio, noindex y sin canonical ni og:url, porque esa página
 * responde a cualquier ruta desconocida. Si el build ya trae el noindex de fuera de producción,
 * lo deja como está.
 */
export function notFoundHtml(html: string): string {
  const withMeta = stripRouteSpecificTags(
    applyMetaToHtml(html, { ...NOT_FOUND_META, canonical: SITE_URL, noindex: true }),
  );
  if (/<meta\s+name="robots"/.test(withMeta)) return withMeta;
  return withMeta.replace('</title>', '</title>\n    <meta name="robots" content="noindex" />');
}
