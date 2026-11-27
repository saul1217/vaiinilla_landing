import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_META,
  NOT_FOUND_META,
  applyMetaToHtml,
  canonicalUrl,
  isIndexable,
  isPrivatePath,
  metaForPath,
  notFoundHtml,
  robotsTxt,
  sitemapXml,
  stripRouteSpecificTags,
} from './seo';

const INDEX_HTML = readFileSync('index.html', 'utf8');

/** Destino del rewrite de vercel.json para una ruta, o null si cae en el 404.html (estado 404). */
function rewriteFor(path: string): string | null {
  const { rewrites } = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
    rewrites: { source: string; destination: string }[];
  };
  // Las fuentes son `/` más un solo grupo de regex, así que path-to-regexp y RegExp coinciden.
  return rewrites.find((rule) => new RegExp(`^${rule.source}$`).test(path))?.destination ?? null;
}

/** Cada <Route path> de router.tsx con valores de ejemplo en los parámetros (sin /__qa, solo dev). */
function appRoutePaths(): string[] {
  const router = readFileSync('src/app/router.tsx', 'utf8');
  return [...router.matchAll(/<Route path="([^"]+)"/g)]
    .map((match) => match[1]!)
    .filter((path) => path !== '*' && !path.startsWith('/__qa'))
    .map((path) => path.replace(/:\w+/g, 'ejemplo-1'));
}

describe('seo', () => {
  it('ninguna URL absoluta de SEO usa www', () => {
    expect(INDEX_HTML).not.toContain('www.vaiinilla.app');
    expect(robotsTxt(true)).not.toContain('www.');
    expect(sitemapXml('2026-11-03')).not.toContain('www.vaiinilla.app');
  });

  it('vercel.json redirige www al dominio sin www conservando la ruta', () => {
    const { redirects } = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      redirects: { source: string; has?: { type: string; value: string }[]; destination: string; permanent: boolean }[];
    };
    const rule = redirects.find((r) => r.has?.some((h) => h.type === 'host' && h.value === 'www.vaiinilla.app'));
    expect(rule).toMatchObject({ source: '/(.*)', destination: 'https://vaiinilla.app/$1', permanent: true });
  });

  it('el canonical es el dominio sin www y sin barra final', () => {
    expect(canonicalUrl('/')).toBe('https://vaiinilla.app/');
    expect(canonicalUrl('/pedir/')).toBe('https://vaiinilla.app/pedir');
    expect(canonicalUrl('/e/cafe-norte')).toBe('https://vaiinilla.app/e/cafe-norte');
  });

  it.each(['/cuenta', '/cuenta/pedidos/7', '/acceso/verificar', '/seguimiento/abc', '/u/12', '/e/cafe/m/tok', '/cafe/m/tok/quien', '/__qa/carrito', '/e/hotel-sol/hotel', '/e/hotel-sol/hotel/codigo', '/e/hotel-sol/hotel/cuenta', '/e/hotel-sol/hotel/pedido', '/e/hotel-sol/hotel/solicitudes/'])(
    '%s es privada',
    (path) => expect(isPrivatePath(path)).toBe(true),
  );

  it.each(['/', '/pedir', '/soporte', '/e/cafe-norte', '/e/cafe-norte/canchas', '/cuentas-claras', '/e/hotel-sol', '/e/hotelero', '/e/cafe/hoteles'])(
    '%s es indexable',
    (path) => expect(isPrivatePath(path)).toBe(false),
  );

  it('cada ruta pública tiene su título y las demás usan el general', () => {
    expect(metaForPath('/soporte').title).toBe('Soporte - Vaiinilla');
    expect(metaForPath('/e/cafe-norte')).toMatchObject({
      title: metaForPath('/').title,
      canonical: 'https://vaiinilla.app/e/cafe-norte',
      noindex: false,
    });
  });

  it('solo un deploy de Vercel fuera de producción deja de indexarse', () => {
    expect(isIndexable('production')).toBe(true);
    expect(isIndexable(undefined)).toBe(true);
    expect(isIndexable('preview')).toBe(false);
    expect(isIndexable('development')).toBe(false);
  });

  it('vercel.json pone noindex por host a todo lo que no es vaiinilla.app ni www', () => {
    const { headers, redirects } = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      headers: { source: string; missing?: { type: string; value: string }[]; headers: { key: string; value: string }[] }[];
      redirects: { has?: { type: string; value: string }[] }[];
    };
    // La redirección de www va antes que las demás, para que /privacidad en www pase primero al apex.
    expect(redirects[0]?.has).toEqual([{ type: 'host', value: 'www.vaiinilla.app' }]);
    const rule = headers.find((h) => h.headers.some((x) => x.key === 'X-Robots-Tag'));
    expect(rule).toMatchObject({ source: '/(.*)', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] });
    const indexedHost = new RegExp(rule!.missing!.find((m) => m.type === 'host')!.value);
    for (const host of ['vaiinilla.app', 'www.vaiinilla.app']) expect(indexedHost.test(host)).toBe(true);
    for (const host of ['dev.vaiinilla.app', 'sand-user.vaiinilla.app', 'vaiinilla-landing-git-develop-saul.vercel.app', 'vaiinilla.app.evil.com']) {
      expect(indexedHost.test(host)).toBe(false);
    }
  });

  it('robots.txt de producción apunta al sitemap y el de preview bloquea todo', () => {
    expect(robotsTxt(true)).toContain('Allow: /\n');
    expect(robotsTxt(true)).toContain('Disallow: /cuenta$\nDisallow: /cuenta/\n');
    expect(robotsTxt(true)).toContain('Sitemap: https://vaiinilla.app/sitemap.xml');
    expect(robotsTxt(false)).toBe('User-agent: *\nDisallow: /\n');
  });

  it('las rutas del huésped de hotel son noindex sin cambiar su canonical ni el menú público', () => {
    expect(metaForPath('/e/hotel-sol/hotel/cuenta')).toMatchObject({
      noindex: true,
      canonical: 'https://vaiinilla.app/e/hotel-sol/hotel/cuenta',
    });
    expect(metaForPath('/e/hotel-sol')).toMatchObject({ noindex: false, canonical: 'https://vaiinilla.app/e/hotel-sol' });
    expect(robotsTxt(true)).toContain('Disallow: /e/*/hotel$\nDisallow: /e/*/hotel/\n');
  });

  it('el title y la description de / dicen Vaiinilla, vaiinilla.app y qué se busca', () => {
    for (const text of [DEFAULT_META.title, DEFAULT_META.description]) {
      expect(text).toContain('Vaiinilla');
      expect(text.toLowerCase()).toContain('vaiinilla.app');
    }
    expect(DEFAULT_META.title).toMatch(/sin filas en Chihuahua/);
    expect(DEFAULT_META.description).toMatch(/recoge sin filas en Chihuahua/);
    expect(DEFAULT_META.description).toMatch(/app para negocios/);
    expect(DEFAULT_META.title.length).toBeLessThanOrEqual(65);
    expect(DEFAULT_META.description.length).toBeLessThanOrEqual(160);
  });

  it('index.html trae el mismo title y description que la home', () => {
    expect(INDEX_HTML).toContain(`<title>${DEFAULT_META.title}</title>`);
    expect(INDEX_HTML).toContain(`<meta name="description" content="${DEFAULT_META.description}" />`);
    expect(INDEX_HTML).toContain(`<meta property="og:description" content="${DEFAULT_META.description}" />`);
  });

  it('el 404.html lleva noindex, su propio título y ni canonical ni og:url', () => {
    const html = notFoundHtml(INDEX_HTML);
    expect(html).toContain(`<title>${NOT_FOUND_META.title}</title>`);
    expect(html.match(/<meta name="robots" content="noindex" \/>/g)).toHaveLength(1);
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('og:url');
    expect(html).toContain('<div id="root"></div>');
  });

  it('el 404.html de un build fuera de producción no repite la meta robots', () => {
    const preview = INDEX_HTML.replace('</head>', '<meta name="robots" content="noindex, nofollow">\n</head>');
    const html = notFoundHtml(preview);
    expect(html.match(/<meta name="robots"/g)).toHaveLength(1);
    expect(html).toContain('content="noindex, nofollow"');
  });

  it('vercel.json manda las rutas prerenderizadas a su HTML y cada ruta de la app a spa.html', () => {
    expect(rewriteFor('/')).toBe('/index.html');
    expect(rewriteFor('/pedir')).toBe('/pedir/index.html');
    expect(rewriteFor('/soporte')).toBe('/soporte/index.html');
    const paths = appRoutePaths();
    expect(paths.length).toBeGreaterThan(20);
    for (const path of paths.filter((p) => !['/', '/pedir', '/soporte'].includes(p))) {
      expect(rewriteFor(path), path).toBe('/spa.html');
      expect(rewriteFor(`${path}/`), `${path}/`).toBe('/spa.html');
    }
    for (const path of ['/cuenta/saldo/recargar', '/e/hotel-sol/hotel/solicitudes', '/cafe-norte/m/tok_1/quien']) {
      expect(rewriteFor(path), path).toBe('/spa.html');
    }
  });

  it.each(['/ads.txt', '/cookies', '/cualquier-cosa', '/cuentas-claras', '/e', '/e/cafe/no-existe', '/seguimiento/abc/extra', '/assets/no-existe.js', '/wp-login.php'])(
    'vercel.json no reescribe %s: cae en el 404.html',
    (path) => expect(rewriteFor(path)).toBeNull(),
  );

  it('las redirecciones legales siguen antes de los rewrites', () => {
    const { redirects } = JSON.parse(readFileSync('vercel.json', 'utf8')) as { redirects: { source: string }[] };
    expect(redirects.map((r) => r.source)).toEqual(expect.arrayContaining(['/privacidad', '/terminos', '/legal']));
  });

  it('el sitemap lista solo las rutas públicas con URL absoluta', () => {
    const xml = sitemapXml('2026-11-03');
    expect(xml.match(/<loc>/g)).toHaveLength(3);
    expect(xml).toContain('<loc>https://vaiinilla.app/soporte</loc>');
    expect(xml).toContain('<loc>https://vaiinilla.app/pedir</loc>');
    expect(xml).toContain('<lastmod>2026-11-03</lastmod>');
  });

  it('aplica el head de la ruta al index.html real', () => {
    const html = applyMetaToHtml(INDEX_HTML, metaForPath('/soporte'));
    expect(html).toContain('<title>Soporte - Vaiinilla</title>');
    expect(html).toContain('<link rel="canonical" href="https://vaiinilla.app/soporte" />');
    expect(html).toContain('<meta property="og:url" content="https://vaiinilla.app/soporte" />');
    expect(html).toContain('<meta name="twitter:title" content="Soporte - Vaiinilla" />');
    expect(html.match(/<title>/g)).toHaveLength(1);
  });

  it('el shell sin prerender no declara canonical ni og:url', () => {
    const html = stripRouteSpecificTags(INDEX_HTML);
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('og:url');
    expect(html).toContain('og:title');
  });

  it('el JSON-LD del index.html es válido', () => {
    const json = INDEX_HTML.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
    const data = JSON.parse(json ?? '') as { '@graph': { '@type': string }[] };
    expect(data['@graph'].map((node: { '@type': string }) => node['@type'])).toEqual([
      'Organization',
      'WebSite',
      'SoftwareApplication',
    ]);
  });
});
