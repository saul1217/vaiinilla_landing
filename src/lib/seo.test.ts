import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  applyMetaToHtml,
  canonicalUrl,
  isIndexable,
  isPrivatePath,
  metaForPath,
  robotsTxt,
  sitemapXml,
  stripRouteSpecificTags,
} from './seo';

const INDEX_HTML = readFileSync('index.html', 'utf8');

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

  it('el sitemap lista solo las rutas públicas con URL absoluta', () => {
    const xml = sitemapXml('2026-11-03');
    expect(xml.match(/<loc>/g)).toHaveLength(3);
    expect(xml).toContain('<loc>https://vaiinilla.app/soporte</loc>');
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
