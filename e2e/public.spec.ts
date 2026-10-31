import { expect, test } from '@playwright/test';
import { loadEnv } from 'vite';
import { assertCiStoreSeeded, CI_MENU_URL, CI_PLACE_NAME, CI_PLACE_NAME_RE } from './ci-store';

// Mismo VITE_STAFF_APP_URL que usa el servidor de Vite del e2e (modo development): .env.development o variable de CI.
const STAFF_APP_URL = loadEnv('development', process.cwd(), 'VITE_').VITE_STAFF_APP_URL;

test('la landing de marketing conserva soporte y manda a pedir, no al panel', async ({ page }) => {
  expect(STAFF_APP_URL, 'falta VITE_STAFF_APP_URL en el ambiente del e2e').toBeTruthy();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /escribe tu mesa/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /empezar a pedir/i }).first()).toHaveAttribute('href', '/pedir');
  await expect(page.getByRole('link', { name: /ya tengo cuenta/i }).first()).toHaveAttribute(
    'href',
    '/cuenta',
  );
  await expect(page.getByRole('link', { name: /soy establecimiento/i }).first()).toHaveAttribute(
    'href',
    STAFF_APP_URL,
  );
  // En móvil las insignias de la barra se ocultan (marketing.css, .nav__actions .store-badges): se comprueba una visible.
  await expect(page.getByText(/próximamente/i).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /todo lo que necesitas/i })).toBeVisible();
  await expect(page.getByText(/restaurantes, cafés, bares/i).filter({ visible: true }).first()).toBeVisible();
});

test('Pedir en la landing entra al app del comprador', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('banner').getByRole('link', { name: /empezar a pedir|pedir/i }).click();
  await expect(page).toHaveURL(/\/pedir$/);
  await expect(page.getByRole('heading', { name: /en qué restaurante estás/i })).toBeVisible();
  await expect(page.getByRole('navigation', { name: /^navegación$/i })).toBeVisible();
  await expect(page).not.toHaveURL(/app\.vaiinilla\.app/);
});

test('soporte sigue publicando el correo oficial', async ({ page }) => {
  await page.goto('/soporte');
  await expect(page.getByRole('heading', { name: /necesitas ayuda/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /equipo@vaiinilla.app/i })).toHaveAttribute(
    'href',
    'mailto:equipo@vaiinilla.app',
  );
});

test('discovery y menú públicos responden contra el backend de development', async ({ page }) => {
  await assertCiStoreSeeded(page.request);
  await page.goto('/pedir');
  await expect(page.getByRole('heading', { name: /en qué restaurante estás/i })).toBeVisible();
  // Ya no existe el botón «Continuar»: con la tienda de CI listada se ofrece «Entrar al menú».
  await page.getByRole('textbox', { name: /buscar restaurante/i }).fill(CI_PLACE_NAME);
  await expect(page.getByRole('radiogroup', { name: /establecimientos/i }).getByRole('radio').first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole('button', { name: /entrar al menú/i })).toBeVisible();
  await page.goto(CI_MENU_URL);
  await expect(page.getByRole('heading', { level: 1, name: CI_PLACE_NAME_RE })).toBeVisible({
    timeout: 20_000,
  });
});

test('guest cart de ci-vaiinilla y /__qa usan fotos reales del catálogo', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/__qa/carrito-lleno');
  // El nombre sale también en el «Del menú» lateral: se acota a las líneas del carrito.
  await expect(page.locator('.alumno-line__copy strong', { hasText: 'CI Bebida de prueba' }).first()).toBeVisible();
  await expect(page.locator('.alumno-line__thumb:not(.alumno-line__thumb--vaini)')).toHaveCount(2);
  await expect(page.locator('.alumno-line__thumb:not(.alumno-line__thumb--vaini)').first()).toHaveAttribute(
    'src',
    /supabase\.co\/storage/,
  );

  await page.goto('/__qa/carrito');
  await expect(page.getByRole('heading', { name: /pedidos anteriores/i })).toBeVisible();
  await expect(page.locator('.alumno-history-row img')).toHaveCount(0);
  await expect(page.getByText('1× CI Bebida de prueba')).toBeVisible();
  await expect(page.getByText('#76 · Entregado')).toBeVisible();
  await expect(page.locator('.alumno-cart-peek__row > img')).toHaveCount(2);

  await page.goto(`${CI_MENU_URL}/carrito`);
  await expect(page.getByRole('heading', { name: /tu pedido/i })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.alumno-cart-peek__row img').first()).toHaveAttribute(
    'src',
    /supabase\.co\/storage/,
    { timeout: 20_000 },
  );

  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['/__qa/pedidos', '/__qa/pedido'] as const) {
    await page.goto(route);
    const thumbs = page.locator('img.alumno-track-card__thumb');
    await expect(thumbs.first()).toHaveAttribute('src', /supabase\.co\/storage/);
    await expect.poll(async () => {
      return thumbs.evaluateAll((nodes) =>
        nodes.every((node) => node instanceof HTMLImageElement && node.naturalWidth > 0),
      );
    }).toBe(true);
    await expect(page.locator('.alumno-track-card__thumb--vaini')).toHaveCount(0);
  }
});
