// Prerender de las rutas públicas (issue #143): escribe en dist/ el HTML inicial con su head
// propio. `/` y `/soporte` llevan además el contenido; `/pedir` depende del API y de la sesión,
// así que solo cambia el head. Uso: después de `vite build` y `vite build --ssr src/prerender.tsx`.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const DIST = 'dist';
const SSR_DIST = 'dist-ssr';
const ROUTES = [
  { path: '/', file: 'index.html', body: true },
  { path: '/soporte', file: 'soporte/index.html', body: true },
  { path: '/pedir', file: 'pedir/index.html', body: false },
];
const ROOT = '<div id="root"></div>';

const { render, metaForPath, applyMetaToHtml, staffAppUrlConfigured } = await import(
  pathToFileURL(join(SSR_DIST, 'prerender.js')).href
);
if (!staffAppUrlConfigured) {
  console.warn('prerender: falta VITE_STAFF_APP_URL; las rutas salen solo con su head, sin contenido.');
}
const shell = readFileSync(join(DIST, 'index.html'), 'utf8');
if (!shell.includes(ROOT)) throw new Error(`dist/index.html no tiene ${ROOT}`);

for (const route of ROUTES) {
  let html = applyMetaToHtml(shell, metaForPath(route.path));
  if (route.body && staffAppUrlConfigured) html = html.replace(ROOT, `<div id="root">${render(route.path)}</div>`);
  const target = join(DIST, route.file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
  console.log(`prerender ${route.path} -> ${target}`);
}

rmSync(SSR_DIST, { recursive: true, force: true });
