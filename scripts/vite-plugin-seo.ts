import type { Plugin } from 'vite';
import { isIndexable, robotsTxt, sitemapXml, stripRouteSpecificTags } from '../src/lib/seo';

export interface SeoPluginOptions {
  /** VERCEL_ENV del build: fuera de production el deploy no se indexa. */
  vercelEnv?: string;
  /** VITE_GOOGLE_SITE_VERIFICATION: la meta solo se emite si está definida. */
  siteVerification?: string;
  /** Fecha del build (YYYY-MM-DD) para el lastmod del sitemap. */
  buildDate?: string;
}

/**
 * robots.txt, sitemap.xml, noindex fuera de producción, la meta de verificación de Search
 * Console y spa.html: el shell sin canonical que Vercel y el service worker sirven a las
 * rutas que no se prerenderizan (index.html queda con el contenido de la home).
 */
export function seoPlugin({ vercelEnv, siteVerification, buildDate }: SeoPluginOptions): Plugin {
  const indexable = isIndexable(vercelEnv);
  const verification = siteVerification?.trim();
  if (verification && !/^[\w-]+$/.test(verification)) {
    throw new Error('VITE_GOOGLE_SITE_VERIFICATION solo admite letras, números, guion y guion bajo.');
  }

  return {
    name: 'vaiinilla-seo',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml() {
      const tags = [];
      if (!indexable) {
        tags.push({ tag: 'meta', attrs: { name: 'robots', content: 'noindex, nofollow' }, injectTo: 'head' as const });
      }
      if (verification) {
        tags.push({
          tag: 'meta',
          attrs: { name: 'google-site-verification', content: verification },
          injectTo: 'head' as const,
        });
      }
      return tags;
    },
    generateBundle(_options, bundle) {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(indexable) });
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: sitemapXml(buildDate ?? new Date().toISOString().slice(0, 10)),
      });
      const index = bundle['index.html'];
      if (index?.type !== 'asset') this.error('No se generó index.html');
      const html = typeof index.source === 'string' ? index.source : new TextDecoder().decode(index.source);
      this.emitFile({ type: 'asset', fileName: 'spa.html', source: stripRouteSpecificTags(html) });
    },
  };
}
