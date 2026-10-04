import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

// Flujo de invitado en la tienda QA de desarrollo (`legibilidad-qa`), en los tres temas del app.
// La cuenta de cliente (`/cuenta`) sale de `.env.e2e.local` (fuera de git); sin ella se omite.
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

const env = { ...loadEnv(), ...process.env };
const SLUG = 'legibilidad-qa';
// Firebase solo autoriza `localhost` (no 127.0.0.1) para iniciar sesión en desarrollo.
const ACCOUNT_ORIGIN = 'http://localhost:4173';
const themes = ['light', 'dark'] as const;

function watchSessionBanner() {
  const mark = () => {
    if (document.body?.innerText.includes('Tu sesión terminó')) {
      (window as unknown as { __sawSessionEnded?: boolean }).__sawSessionEnded = true;
    }
  };
  new MutationObserver(mark).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
}

async function expectNoSessionBanner(page: Page) {
  await expect(page.getByText('Tu sesión terminó')).toHaveCount(0);
  expect(await page.evaluate(() => Boolean((window as unknown as { __sawSessionEnded?: boolean }).__sawSessionEnded))).toBe(false);
}

async function waitForAccountSettled(page: Page) {
  await page.getByRole('heading', { name: 'Configuración' }).waitFor({ timeout: 20_000 });
  await page.waitForLoadState('networkidle');
}

async function signIn(page: Page) {
  await page.getByRole('button', { name: /iniciar sesión/i }).or(page.getByRole('link', { name: /iniciar sesión/i })).first().click();
  await page.getByLabel(/correo/i).first().fill(env.E2E_CLIENTE_EMAIL);
  await page.getByLabel(/contraseña/i).first().fill(env.E2E_PASSWORD);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  const form = page.getByRole('heading', { name: 'Inicia sesión' });
  const failure = page.locator('.alumno-error');
  await Promise.race([
    form.waitFor({ state: 'hidden', timeout: 45_000 }),
    failure.waitFor({ timeout: 45_000 }),
  ]);
  if (await form.isVisible()) throw new Error((await failure.first().innerText()) || 'El acceso no avanzó.');
}

async function snap(page: Page, name: string, scheme: string, projectName: string) {
  await page.waitForTimeout(800);
  await page.screenshot({
    path: `test-results/legibilidad-cliente/${projectName}-${scheme}/${name}.png`,
    fullPage: true,
  });
}

for (const scheme of themes) {
  test.describe(`tema ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    test('invitado: descubrir, menú, producto y carrito', async ({ page }, info) => {
      const shot = (name: string) => snap(page, name, scheme, info.project.name);
      await page.goto('/pedir');
      await page.waitForLoadState('networkidle');
      await shot('01-pedir');

      await page.goto(`/e/${SLUG}`);
      await page.waitForLoadState('networkidle');
      await shot('02-menu');

      await page.locator('.alumno-product').first().click();
      await page.locator('.alumno-psheet').first().waitFor();
      await shot('03-producto');

      const radios = page.locator('.alumno-psheet input[type="radio"]');
      if (await radios.count()) await radios.first().check({ force: true });
      await page.getByRole('button', { name: /agregar|añadir|al carrito/i }).first().click();
      await shot('04-agregado');

      await page.goto(`/e/${SLUG}/carrito`);
      await page.waitForLoadState('networkidle');
      await shot('05-carrito');
    });

    test('invitado: mesa compartida por QR y seguimiento inexistente', async ({ page }, info) => {
      const shot = (name: string) => snap(page, name, scheme, info.project.name);
      await page.goto(`/${SLUG}/m/esp_legibilidadqamesa4AAAAAAAAAAAAAAAAAAAAAAAAA`);
      await page.waitForLoadState('load'); // la mesa compartida sondea el backend: nunca queda en reposo
      await shot('06-mesa-qr');
      await page.goto('/seguimiento/token-inexistente');
      await page.waitForLoadState('networkidle');
      await shot('07-seguimiento-error');
    });

    test('cuenta: acceso y pantallas con el cliente QA', async ({ page }, info) => {
      const shot = (name: string) => snap(page, name, scheme, info.project.name);
      await page.addInitScript(watchSessionBanner);
      await page.goto(`${ACCOUNT_ORIGIN}/cuenta`);
      await page.waitForLoadState('networkidle');
      await shot('08-cuenta-acceso');
      test.skip(!env.E2E_CLIENTE_EMAIL || !env.E2E_PASSWORD, 'Falta la cuenta cliente QA en .env.e2e.local.');

      await shot('08b-cuenta-login');
      test.setTimeout(90_000);
      await signIn(page);
      const apiStatuses: string[] = [];
      const apiBodies: Promise<void>[] = [];
      page.on('response', (response) => {
        const url = response.url();
        if (!url.includes('/api/v1/')) return;
        apiBodies.push(response.text().then((body) => {
          apiStatuses.push(`${response.status()} ${url} ${body.slice(0, 240)}`);
        }).catch(() => {
          apiStatuses.push(`${response.status()} ${url}`);
        }));
      });
      await page.goto(`${ACCOUNT_ORIGIN}/cuenta`);
      await waitForAccountSettled(page);
      await Promise.all(apiBodies);
      await shot('09-cuenta-inicio');
      if (await page.getByText('Tu sesión terminó').count()) {
        throw new Error(apiStatuses.join(' | ') || 'banner sin respuesta /api/v1');
      }
      await expectNoSessionBanner(page);
      for (const [route, name, heading] of [
        ['/cuenta/pedidos', '10-cuenta-pedidos', 'Mis pedidos'],
        ['/cuenta/saldo', '11-cuenta-saldo', 'Cartera'],
      ] as const) {
        await page.goto(`${ACCOUNT_ORIGIN}${route}`);
        await page.getByRole('heading', { name: heading }).waitFor({ timeout: 20_000 });
        await shot(name);
        if (await page.getByText('Tu sesión terminó').count()) {
          throw new Error(`${name}: ${apiStatuses.join(' | ') || 'sin respuesta /api/v1'}`);
        }
        await expectNoSessionBanner(page);
      }
    });
  });
}

test.describe('tema amoled', () => {
  test.use({ colorScheme: 'dark' });

  test('cuenta: configuración, pedidos y saldo', async ({ page }, info) => {
    test.skip(!env.E2E_CLIENTE_EMAIL || !env.E2E_PASSWORD, 'Falta la cuenta cliente QA en .env.e2e.local.');
    test.setTimeout(90_000);
    const shot = (name: string) => snap(page, name, 'amoled', info.project.name);
    await page.addInitScript(() => {
      localStorage.setItem('vaiinilla.buyer.theme.v1', 'amoled');
    });
    await page.addInitScript(watchSessionBanner);
    await page.goto(`${ACCOUNT_ORIGIN}/cuenta`);
    await signIn(page);
    const apiStatuses: string[] = [];
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/v1/pedidos') || url.includes('/api/v1/wallets/')) {
        apiStatuses.push(`${response.status()} ${url}`);
      }
    });
    await page.goto(`${ACCOUNT_ORIGIN}/cuenta`);
    await waitForAccountSettled(page);
    await shot('09-cuenta-inicio');
    await expectNoSessionBanner(page);
    for (const [route, name, heading] of [
      ['/cuenta/pedidos', '10-cuenta-pedidos', 'Mis pedidos'],
      ['/cuenta/saldo', '11-cuenta-saldo', 'Cartera'],
    ] as const) {
      await page.goto(`${ACCOUNT_ORIGIN}${route}`);
      await page.getByRole('heading', { name: heading }).waitFor({ timeout: 20_000 });
      await shot(name);
      if (await page.getByText('Tu sesión terminó').count()) {
        throw new Error(`${name}: ${apiStatuses.join(' | ') || 'sin respuesta /api/v1'}`);
      }
      await expectNoSessionBanner(page);
    }
  });
});
