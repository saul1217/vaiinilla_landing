import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173';
const external = Boolean(process.env.E2E_BASE_URL);

// Las referencias solo se regeneran en el contenedor fijo de Playwright (CI), nunca en máquinas locales,
// y las corridas bloqueadas por datos de develop se omiten sin escribir capturas.
if (process.argv.includes('--update-snapshots') && process.env.PLAYWRIGHT_CONTAINER !== '1') {
  throw new Error('Las capturas de referencia solo se generan en el contenedor de Playwright en CI (PLAYWRIGHT_CONTAINER=1).');
}

export default defineConfig({
  testDir: './e2e-ui',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', caret: 'hide' } },
  use: { baseURL, locale: 'es-MX', timezoneId: 'America/Mexico_City', trace: 'on-first-retry' },
  webServer: external
    ? undefined
    : { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173', url: baseURL, reuseExistingServer: !process.env.CI },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
