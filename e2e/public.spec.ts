import { expect, test } from '@playwright/test';

test('la landing de marketing conserva soporte y manda a pedir, no al panel', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /más recreo/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /pedir ahora/i }).first()).toHaveAttribute(
    'href',
    '/pedir',
  );
  await expect(page.getByRole('link', { name: /abrir el panel/i })).toHaveAttribute(
    'href',
    'https://app.vaiinilla.app',
  );
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
  await expect(page.getByRole('heading', { name: /encuentra tu cafetería/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /ver menú/i }).first()).toBeVisible({ timeout: 20_000 });
  await page.goto('/e/demo-a');
  await expect(page.getByRole('heading', { name: /cafetería demo a/i })).toBeVisible({
    timeout: 20_000,
  });
});
