import { COURTS_SLUG, SCREENS, SHOP_SLUG, expect, gotoReady, signIn, test } from './support';

test.use({ viewport: { width: 390, height: 844 } });

test('Escape cierra la hoja de producto y devuelve el foco', async ({ prepared: page, apiProblems }) => {
  await gotoReady(page, `/e/${SHOP_SLUG}`, apiProblems, '.alumno-product');
  const product = page.locator('.alumno-product').first();
  await product.focus();
  await page.keyboard.press('Enter');
  await page.locator('.alumno-psheet').first().waitFor();
  await page.keyboard.press('Escape');
  await expect(page.locator('.alumno-psheet')).toHaveCount(0);
  await expect(product).toBeFocused();
});

for (const screen of SCREENS) {
  test(`${screen.key}: sin desbordamiento horizontal a 390 px`, async ({ prepared: page, apiProblems }) => {
    if (screen.auth) await signIn(page);
    await gotoReady(page, screen.path, apiProblems, screen.ready);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test(`${screen.key}: objetivos táctiles de al menos 44 px`, async ({ prepared: page, apiProblems }) => {
    if (screen.auth) await signIn(page);
    await gotoReady(page, screen.path, apiProblems, screen.ready);
    const small = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('button, a[href], [role="button"], select'))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && (r.width < 44 || r.height < 44);
        })
        .map((el) => `${el.tagName.toLowerCase()}.${el.className} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`),
    );
    expect(small).toEqual([]);
  });
}

test.describe('estados de carga, vacío y error', () => {
  test('error de API: la pantalla no queda en blanco', async ({ prepared: page }) => {
    await page.route('**/api/v1/**', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
    await page.goto('/pedir');
    await expect(page.locator('#root')).not.toBeEmpty();
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('vacío: sin resultados la pantalla sigue con contenido', async ({ prepared: page }) => {
    await page.route('**/api/v1/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":[],"items":[]}' }),
    );
    await page.goto('/pedir');
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('carga: con respuesta lenta la pantalla ya tiene contenido', async ({ prepared: page }) => {
    await page.route('**/api/v1/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.goto(`/e/${COURTS_SLUG}/canchas`);
    await expect(page.locator('#root')).not.toBeEmpty();
  });
});
