import { expect, test } from '@playwright/test';

test('la landing de marketing conserva soporte y manda a pedir, no al panel', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /más tiempo/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /^pedir$/i }).first()).toHaveAttribute('href', '/pedir');
  await expect(page.getByRole('link', { name: /ya tengo cuenta/i }).first()).toHaveAttribute(
    'href',
    '/cuenta',
  );
  await expect(page.getByRole('link', { name: /soy establecimiento/i }).first()).toHaveAttribute(
    'href',
    'https://app.vaiinilla.app',
  );
  await expect(page.getByText(/próximamente/i).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /el menú del lugar/i })).toBeVisible();
  await expect(page.getByText(/cualquier negocio de comida/i).first()).toBeVisible();
});

test('Pedir en la landing entra al app del comprador', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('banner').getByRole('link', { name: /^pedir$/i }).click();
  await expect(page).toHaveURL(/\/pedir$/);
  await expect(page.getByRole('heading', { name: /dónde comes hoy/i })).toBeVisible();
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
  await page.goto('/pedir');
  await expect(page.getByRole('heading', { name: /dónde comes hoy/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /continuar/i })).toBeVisible({ timeout: 20_000 });
  await page.goto('/e/demo-a');
  await expect(page.getByRole('heading', { name: /cafetería demo a/i })).toBeVisible({
    timeout: 20_000,
  });
});

test('guest cart de Venecia y /__qa usan fotos reales del catálogo', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/__qa/carrito-lleno');
  await expect(page.getByText('fruti Lupis')).toBeVisible();
  await expect(page.locator('.alumno-line__thumb:not(.alumno-line__thumb--vaini)')).toHaveCount(2);
  await expect(page.locator('.alumno-line__thumb:not(.alumno-line__thumb--vaini)').first()).toHaveAttribute(
    'src',
    /supabase\.co\/storage/,
  );

  await page.goto('/__qa/carrito');
  await expect(page.getByRole('heading', { name: /pedidos anteriores/i })).toBeVisible();
  await expect(page.locator('.alumno-history-row img')).toHaveCount(0);
  await expect(page.getByText('1× fruti Lupis')).toBeVisible();
  await expect(page.getByText('#76 · Entregado')).toBeVisible();
  await expect(page.locator('.alumno-cart-peek__row > img')).toHaveCount(2);

  await page.goto('/e/venecia-tienda/carrito');
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
