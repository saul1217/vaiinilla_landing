import { defineConfig, devices } from '@playwright/test';

// E2E de la landing contra el stack local de CI (QA-044): backend + emulador de Auth.
// Nunca apunta a develop ni a un Firebase real. Variables del stack:
//   E2E_API_ORIGIN            backend del stack            (http://127.0.0.1:3000)
//   E2E_AUTH_EMULATOR_URL     emulador de Auth             (http://127.0.0.1:9099)
//   E2E_FIREBASE_PROJECT_ID   proyecto del emulador        (demo-vaiinilla)
//   E2E_PLACE_SLUG            establecimiento sembrado     (obligatoria)
//   E2E_TABLE_QR_TOKEN        QR de una mesa sembrada      (obligatoria)
//   E2E_PRODUCT_NAME          producto disponible del menú (obligatoria)
const apiOrigin = process.env.E2E_API_ORIGIN ?? 'http://127.0.0.1:3000';
const authEmulator = process.env.E2E_AUTH_EMULATOR_URL ?? 'http://127.0.0.1:9099';
const projectId = process.env.E2E_FIREBASE_PROJECT_ID ?? 'demo-vaiinilla';
const port = 4174;

export default defineConfig({
  testDir: './e2e/stack',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    env: {
      E2E_API_ORIGIN: apiOrigin,
      VITE_APP_ENV: 'development',
      VITE_APP_URL: 'https://sand-user.vaiinilla.app',
      VITE_API_URL: '/api/v1',
      VITE_FIREBASE_API_KEY: 'e2e-fake-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'localhost',
      VITE_FIREBASE_PROJECT_ID: projectId,
      VITE_FIREBASE_APP_ID: 'e2e-app-id',
      VITE_FIREBASE_AUTH_EMULATOR_URL: authEmulator,
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
