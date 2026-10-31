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

const shots = [
  { path: '/pedir', file: 'screen-entry.jpg', wait: 2000 },
  { path: '/__qa/carrito-lleno', file: 'screen-cart.jpg', wait: 800 },
  { path: '/__qa/pedido', file: 'screen-checkout.jpg', wait: 800 },
  { path: '/__qa/pedidos', file: 'screen-orders.jpg', wait: 800 },
  { path: '/__qa/pedido-mesa', file: 'screen-table-order.jpg', wait: 800 },
  { path: '/__qa/cartera', file: 'screen-wallet.jpg', wait: 800 },
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});

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
