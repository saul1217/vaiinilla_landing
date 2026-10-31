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
const themes = ['light', 'dark'] as const;

function watchSessionBanner() {
  const mark = () => {
    if (document.body?.innerText.includes('Tu acceso terminó')) {
      (window as unknown as { __sawSessionEnded?: boolean }).__sawSessionEnded = true;
    }
  };
  new MutationObserver(mark).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
}

async function expectNoSessionBanner(page: Page) {
  await expect(page.getByText('Tu acceso terminó')).toHaveCount(0);
  expect(await page.evaluate(() => Boolean((window as unknown as { __sawSessionEnded?: boolean }).__sawSessionEnded))).toBe(false);
}

async function waitForAccountSettled(page: Page) {
  await page.getByRole('heading', { name: 'Configuración' }).waitFor({ timeout: 20_000 });
}

async function signIn(page: Page) {
  await page.getByRole('button', { name: /entrar a mi cuenta/i }).or(page.getByRole('link', { name: /entrar a mi cuenta/i })).first().click();
  await page.getByLabel(/correo/i).first().fill(env.E2E_CLIENTE_EMAIL);
  await page.getByLabel(/contraseña/i).first().fill(env.E2E_PASSWORD);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  const form = page.getByRole('heading', { name: 'Entrar a mi cuenta' });
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
      await page.getByRole('radiogroup', { name: 'Establecimientos' }).waitFor();
      await shot('01-pedir');

      await page.goto(`/e/${SLUG}`);
      await page.locator('.alumno-product').first().waitFor();
      await shot('02-menu');

      await page.locator('.alumno-product').first().click();
      await page.locator('.alumno-psheet').first().waitFor();
      await shot('03-producto');

      const radios = page.locator('.alumno-psheet input[type="radio"]');
      if (await radios.count()) await radios.first().check({ force: true });
      await page.getByRole('button', { name: /agregar|añadir|al carrito/i }).first().click();
      await shot('04-agregado');

      await page.goto(`/e/${SLUG}/carrito`);
      await page.locator('.alumno-cart-layout, .alumno-cart-empty').first().waitFor();
      await shot('05-carrito');
    });

    test('invitado: mesa compartida por QR y seguimiento inexistente', async ({ page }, info) => {
      const shot = (name: string) => snap(page, name, scheme, info.project.name);
      await page.goto(`/${SLUG}/m/esp_legibilidadqamesa4AAAAAAAAAAAAAAAAAAAAAAAAA`);
      await page.waitForLoadState('load'); // la mesa compartida sondea el backend: nunca queda en reposo
      await shot('06-mesa-qr');
      await page.goto('/seguimiento/token-inexistente');
      await page.getByRole('alert').getByRole('heading', { name: 'No encontramos este pedido' }).waitFor();
      await shot('07-seguimiento-error');
    });

    test('cuenta: acceso y pantallas con el cliente QA', async ({ page }, info) => {
      const shot = (name: string) => snap(page, name, scheme, info.project.name);
      await page.addInitScript(watchSessionBanner);
      await page.goto('/cuenta');
      await page.locator('main').waitFor();
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
      await page.goto('/cuenta');
      await waitForAccountSettled(page);
      await Promise.all(apiBodies);
      await shot('09-cuenta-inicio');
      if (await page.getByText('Tu acceso terminó').count()) {
        throw new Error(apiStatuses.join(' | ') || 'banner sin respuesta /api/v1');
      }
      await expectNoSessionBanner(page);
      for (const [route, name, heading] of [
        ['/cuenta/pedidos', '10-cuenta-pedidos', 'Mis pedidos'],
        ['/cuenta/saldo', '11-cuenta-saldo', 'Mi saldo'],
      ] as const) {
        await page.goto(route);
        await page.getByRole('heading', { name: heading }).waitFor({ timeout: 20_000 });
        await shot(name);
        if (await page.getByText('Tu acceso terminó').count()) {
          throw new Error(`${name}: ${apiStatuses.join(' | ') || 'sin respuesta /api/v1'}`);
        }
        await expectNoSessionBanner(page);
      }
    });
  });
}

test.describe('preferencia AMOLED heredada', () => {
  test.use({ colorScheme: 'dark' });

  test('abre Mi saldo con tema oscuro y mantiene la preferencia compatible', async ({ page }, info) => {
    test.skip(!env.E2E_CLIENTE_EMAIL || !env.E2E_PASSWORD, 'Falta la cuenta cliente QA en .env.e2e.local.');
    test.setTimeout(90_000);
    const shot = (name: string) => snap(page, name, 'dark', info.project.name);
    await page.addInitScript(() => {
      localStorage.setItem('vaiinilla.buyer.theme.v1', 'amoled');
    });
    await page.addInitScript(watchSessionBanner);
    await page.goto('/cuenta');
    await signIn(page);
    await page.goto('/cuenta/saldo');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('heading', { name: 'Mi saldo' }).waitFor({ timeout: 20_000 });
    await shot('11-cuenta-saldo');
    await expectNoSessionBanner(page);
  });
});
