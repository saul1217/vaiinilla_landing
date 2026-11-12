// Evidencia visual del PR #160 (tema AMOLED): /pedir y el menú de la tienda de CI a 390x844
// en claro, oscuro y AMOLED. La API se simula en el navegador: no sale ninguna petición a
// development ni a producción; solo se cargan las fuentes de Google. Uso:
//   node docs/evidencia/pr160/capturas-temas.mjs <baseURL> <carpeta de salida>
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const [baseURL = 'http://127.0.0.1:4173', outDir = 'test-results/evidencia-pr160'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const place = {
  id: '00000000-0000-4000-8000-000000000001',
  nombre: 'ci-vaiinilla',
  slug: 'ci-vaiinilla',
  identificador_cliente_etiqueta: 'Nombre',
  identificador_cliente_obligatorio: false,
  tipo: 'restaurante',
  descripcion: 'Tienda de CI',
  imagen_url: null,
  direccion: 'Av. Siempre Viva 123',
  horario: 'Lun a Dom 8:00 a 22:00',
  acepta_tarjeta: true,
  permite_saldo: true,
};
const product = (id, nombre, precio, categoria_id) => ({
  id, categoria_id, estacion_preparacion: 'cocina', nombre, descripcion: `Descripción de ${nombre}`,
  ingredientes: null, alergenos: null, tiempo_estimado_min: 10, precio_mostrador: precio,
  precio_digital: precio, disponible: true, imagen_url: null, grupos_opcion: [],
});
const catalog = {
  categorias: [{ id: 1, nombre: 'Tacos', orden: 1 }, { id: 2, nombre: 'Bebidas', orden: 2 }],
  productos: [product(1, 'Tacos al pastor', '65.00', 1), product(2, 'Pozole', '90.00', 1), product(3, 'Agua de horchata', '30.00', 2)],
};
const status = {
  recibiendo_pedidos: true, sesion_caja_abierta: true, caja_en_linea: true, cocina_en_linea: true,
  tiempo_estimado_min: 15, consultado_en: '2026-10-20T15:00:00Z', tipo: 'restaurante',
};
const ok = (data, meta = {}) => ({ status: 200, json: { data, meta, error: null } });

function mock(path) {
  if (/\/publico\/establecimientos\/?$/.test(path)) return ok([place], { cursor: null });
  if (/\/publico\/establecimientos\/ci-vaiinilla\/catalogo$/.test(path)) return ok(catalog);
  if (/\/publico\/establecimientos\/ci-vaiinilla\/(estado|estado-operativo)/.test(path)) return ok(status);
  if (/\/publico\/establecimientos\/ci-vaiinilla$/.test(path)) return ok(place);
  return { status: 404, json: { data: null, meta: {}, error: { codigo: 'NO_ENCONTRADO', mensaje: 'Simulado' } } };
}

const themes = [
  { name: 'claro', scheme: 'light' },
  { name: 'oscuro', scheme: 'dark' },
  { name: 'amoled', scheme: 'dark', stored: 'amoled' },
];
const pages = [
  { name: 'pedir', path: '/pedir', ready: '.alumno-discovery' },
  { name: 'menu-tienda', path: '/e/ci-vaiinilla', ready: '.alumno-product' },
];

const browser = await chromium.launch();
for (const theme of themes) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    colorScheme: theme.scheme, locale: 'es-MX', timezoneId: 'America/Mexico_City', serviceWorkers: 'block',
  });
  if (theme.stored) await context.addInitScript((value) => localStorage.setItem('vaiinilla.buyer.theme.v1', value), theme.stored);
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('/api/v1/')) return route.fulfill(mock(url.pathname));
    // Solo se dejan pasar las fuentes de Google (Roboto y Poppins, como en index.html).
    if (url.origin !== new URL(baseURL).origin && !/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date('2026-10-20T15:00:00Z'));
  for (const target of pages) {
    await page.goto(baseURL + target.path);
    const ready = await page.locator(target.ready).first().waitFor({ timeout: 15_000 }).then(() => true, () => false);
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
    await page.evaluate(() => document.fonts.ready);
    const info = await page.evaluate(() => ({
      dataTheme: document.documentElement.dataset.theme ?? null,
      vaiTheme: document.documentElement.dataset.vaiTheme ?? null,
      themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      font: getComputedStyle(document.body).fontFamily,
    }));
    const file = `${outDir}/${target.name}-${theme.name}-390x844.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log(JSON.stringify({ file, ready, ...info }));
  }
  await context.close();
}
await browser.close();
