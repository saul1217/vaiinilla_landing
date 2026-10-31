/**
 * Captures buyer-app screens for public/screens (mobile viewport).
 * Run with: node scripts/capture-marketing-screens.mjs [baseUrl]
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(root, '..', 'public', 'screens');
const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const marketing = '?marketing=1';

const shots = [
  { path: `/__qa/entrada${marketing}`, file: 'screen-entry.jpg', wait: 800 },
  { path: `/__qa/carrito-lleno${marketing}`, file: 'screen-cart.jpg', wait: 800 },
  { path: `/__qa/pedido${marketing}`, file: 'screen-checkout.jpg', wait: 800 },
  { path: `/__qa/pedidos${marketing}`, file: 'screen-orders.jpg', wait: 800 },
  { path: `/__qa/pedido-mesa${marketing}`, file: 'screen-table-order.jpg', wait: 800 },
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
await context.addInitScript(() => {
  localStorage.clear();
  sessionStorage.clear();
});
const page = await context.newPage();

for (const shot of shots) {
  await page.goto(`${base}${shot.path}`, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(shot.wait);
  await page.screenshot({
    path: path.join(outDir, shot.file),
    type: 'jpeg',
    quality: 86,
    fullPage: false,
  });
  console.log('wrote', shot.file);
}

await browser.close();