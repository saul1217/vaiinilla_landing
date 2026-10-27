import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test as base, expect, type Page } from '@playwright/test';

function loadEnv(): Record<string, string> {
  try {
    const lines = readFileSync(resolve(process.cwd(), '.env.e2e.local'), 'utf8').split('\n');
    return Object.fromEntries(
      lines.filter((line) => line.includes('=')).map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
    );
  } catch {
    return {};
  }
}

export const env = { ...loadEnv(), ...process.env };

// Datos sembrados en CI con `/dev/test-setup`; nunca se editan a mano.
export const SHOP_SLUG = env.E2E_UI_SHOP_SLUG ?? env.E2E_PLACE_SLUG ?? 'ci-vaiinilla';
export const COURTS_SLUG = env.E2E_UI_COURTS_SLUG ?? env.E2E_PLACE_SLUG ?? 'ci-vaiinilla';
export const FROZEN_NOW = new Date('2026-10-20T15:00:00.000Z');
export const THEMES = ['light', 'dark'] as const;
export const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844 },
  { name: '1280x800', width: 1280, height: 800 },
] as const;

// Horas, contadores y folios cambian entre corridas: se ocultan, no se comparan.
export const VOLATILE_SELECTORS = [
  'time',
  '[data-volatile]',
  '.alumno-track-card__folio',
  '.alumno-pickup__folio',
  '.alumno-res__now',
  '.alumno-res__now-badge',
  '.alumno-res__hours-count',
  '.alumno-res__expired',
  '.alumno-res__hour-time',
  '.alumno-codesheet__slots',
];

const STABLE_CSS = `
*, *::before, *::after {
  animation: none !important;
  transition: none !important;
  caret-color: transparent !important;
  scroll-behavior: auto !important;
}
${VOLATILE_SELECTORS.join(',\n')} { visibility: hidden !important; }
`;

type ApiProblem = { status: number; url: string };

export const test = base.extend<{ prepared: Page; apiProblems: ApiProblem[] }>({
  // eslint-disable-next-line no-empty-pattern
  apiProblems: async ({}, use) => {
    await use([]);
  },
  prepared: async ({ page, apiProblems }, use) => {
    await page.clock.install({ time: FROZEN_NOW });
    await page.clock.setFixedTime(FROZEN_NOW);
    page.on('response', (response) => {
      if (response.url().includes('/api/v1/') && response.status() >= 500) {
        apiProblems.push({ status: response.status(), url: response.url() });
      }
    });
    page.on('requestfailed', (request) => {
      if (request.url().includes('/api/v1/')) apiProblems.push({ status: 0, url: request.url() });
    });
    await use(page);
  },
});

export { expect };

export async function stabilize(page: Page) {
  await page.addStyleTag({ content: STABLE_CSS });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle').catch(() => undefined);
}

// Falla por datos de develop (API caída, tienda sin sembrar) => bloqueada, no regresión.
// Una corrida bloqueada se omite: no compara ni escribe capturas, así que no toca las referencias.
export function skipIfBlocked(apiProblems: ApiProblem[], extra?: string) {
  if (apiProblems.length || extra) {
    const detail = apiProblems.map((p) => `${p.status} ${p.url}`).join(' | ') || extra;
    test.info().annotations.push({ type: 'bloqueada', description: String(detail) });
    test.skip(true, `BLOQUEADA por datos/API de develop (no es regresión): ${detail}`);
  }
}

export async function gotoReady(page: Page, path: string, apiProblems: ApiProblem[], readyLocator?: string) {
  const response = await page.goto(path);
  skipIfBlocked(apiProblems, response && response.status() >= 500 ? `HTTP ${response.status()} en ${path}` : undefined);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  if (readyLocator) {
    const ready = await page
      .locator(readyLocator)
      .first()
      .waitFor({ timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    skipIfBlocked(apiProblems, ready ? undefined : `no apareció ${readyLocator} en ${path} (datos sembrados ausentes)`);
  }
  skipIfBlocked(apiProblems);
  await stabilize(page);
}

export async function signIn(page: Page) {
  if (!env.E2E_CLIENTE_EMAIL || !env.E2E_PASSWORD) {
    test.skip(true, 'BLOQUEADA: falta la cuenta cliente de CI (E2E_CLIENTE_EMAIL / E2E_PASSWORD).');
  }
  await page.goto('/cuenta');
  // Sin sesión, /cuenta abre primero la portada; el formulario aparece tras «Iniciar sesión».
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await page.getByLabel(/correo/i).first().fill(env.E2E_CLIENTE_EMAIL!);
  await page.getByLabel(/contraseña/i).first().fill(env.E2E_PASSWORD!);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  const heading = page.getByRole('heading', { name: 'Inicia sesión' });
  const alert = page.getByRole('alert').first();
  const outcome = await Promise.race([
    heading.waitFor({ state: 'hidden', timeout: 45_000 }).then(() => 'ok' as const),
    alert.waitFor({ state: 'visible', timeout: 45_000 }).then(() => 'alert' as const),
  ]);
  if (outcome === 'ok') return;
  const message = (await alert.innerText()).trim();
  // Que la contraseña no quede en el snapshot de la página que guarda el reporte.
  await page.getByLabel(/contraseña/i).first().fill('');
  // Un rechazo de configuración de Firebase (referer/dominio no autorizado) no es una regresión de la interfaz.
  test.skip(
    /no está autorizado|referer|requests-from|unauthorized-domain|api-key|app-not-authorized/i.test(message),
    `BLOQUEADA por configuración de Firebase en develop-e2e: ${message}`,
  );
  throw new Error(`Inicio de sesión rechazado: ${message}`);
}

export const SCREENS = [
  { key: 'pedir', path: '/pedir', ready: '.alumno-discovery', auth: false },
  { key: 'menu-tienda', path: `/e/${SHOP_SLUG}`, ready: '.alumno-product', auth: false },
  { key: 'canchas', path: `/e/${COURTS_SLUG}/canchas`, ready: '.alumno-res', auth: false },
  { key: 'mis-pedidos', path: '/cuenta/pedidos', ready: 'h1, h2', auth: true },
] as const;
