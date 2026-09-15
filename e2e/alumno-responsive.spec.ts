import { expect, test, type Page } from '@playwright/test';

async function metrics(page: Page) {
  return page.evaluate(() => {
    const shell = document.querySelector('.alumno');
    const nav = document.querySelector('.alumno-nav');
    const grid = document.querySelector('.alumno-grid');
    const discovery = document.querySelector('.alumno-discovery');
    const cart = document.querySelector('.alumno-cart-layout');
    const splash = document.querySelector('.alumno-splash');
    const sheet = document.querySelector('.alumno-sheet');
    const dialog = document.querySelector('.alumno-sheet__dialog');
    const brand = document.querySelector('.alumno-nav__brand');
    const cs = (el: Element | null) => (el ? getComputedStyle(el) : null);
    const cols = (value: string | undefined) =>
      value ? value.split(' ').filter((part) => part && part !== 'none').length : 0;
    return {
      innerWidth: window.innerWidth,
      alumnoWidth: shell ? Math.round(shell.getBoundingClientRect().width) : 0,
      alumnoMax: cs(shell)?.maxWidth ?? null,
      navWidth: nav ? Math.round(nav.getBoundingClientRect().width) : 0,
      navPos: cs(nav)?.position ?? null,
      navWidthCss: cs(nav)?.width ?? null,
      brandDisplay: brand ? cs(brand)?.display : null,
      menuCols: grid ? cols(cs(grid)?.gridTemplateColumns) : 0,
      discoveryCols: discovery ? cols(cs(discovery)?.gridTemplateColumns) : 0,
      cartCols: cart ? cols(cs(cart)?.gridTemplateColumns) : 0,
      splashCols: splash ? cols(cs(splash)?.gridTemplateColumns) : 0,
      sheetMax: sheet ? cs(sheet)?.maxWidth : null,
      dialogWidth: dialog ? Math.round(dialog.getBoundingClientRect().width) : 0,
      hasDevice: Boolean(document.querySelector('.device')),
      hasAlumnoNav: Boolean(nav),
      hasMarketingNav: Boolean(document.querySelector('[aria-label="Navegación principal"]')),
    };
  });
}

test.describe('alumno responsive', () => {
  test('móvil 390: shell y nav a 100%, menú 2 columnas, sin marco de 480', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => sessionStorage.setItem('vaiinilla.buyer.guest-explore.v1', '1'));
    await page.goto('/pedir');
    await expect(page.getByRole('heading', { name: /dónde comes hoy/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continuar/i })).toBeVisible({ timeout: 20_000 });
    const discovery = await metrics(page);
    expect(discovery.alumnoMax).toBe('none');
    expect(discovery.alumnoWidth).toBe(390);
    expect(discovery.navWidth).toBe(390);
    expect(discovery.navPos).toBe('fixed');
    expect(discovery.brandDisplay).toBe('none');
    expect(discovery.hasDevice).toBe(false);

    await page.goto('/e/demo-a');
    await expect(page.getByRole('heading', { name: /cafetería demo a/i })).toBeVisible({
      timeout: 20_000,
    });
    const menu = await metrics(page);
    expect(menu.menuCols).toBe(2);
    await page.getByRole('button', { name: /chocolate frío/i }).click();
    const sheet = await metrics(page);
    expect(sheet.sheetMax).toBe('none');
    expect(sheet.dialogWidth).toBe(390);
  });

  test('tablet 850: top bar full-bleed y menú 3 columnas', async ({ page }) => {
    await page.setViewportSize({ width: 850, height: 1024 });
    await page.addInitScript(() => sessionStorage.setItem('vaiinilla.buyer.guest-explore.v1', '1'));
    await page.goto('/e/demo-a');
    await expect(page.getByRole('heading', { name: /cafetería demo a/i })).toBeVisible({
      timeout: 20_000,
    });
    const menu = await metrics(page);
    expect(menu.alumnoWidth).toBe(850);
    expect(menu.navWidth).toBe(850);
    expect(menu.navPos).toBe('sticky');
    expect(menu.brandDisplay).toBe('block');
    expect(menu.menuCols).toBe(3);
  });

  test('desktop 1280 y 1440: rail, 4 columnas, ficha/pago no son un teléfono', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('vaiinilla.buyer.guest-explore.v1', '1'));

    for (const width of [1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/e/demo-a');
      await expect(page.getByRole('heading', { name: /cafetería demo a/i })).toBeVisible({
        timeout: 20_000,
      });
      const menu = await metrics(page);
      expect(menu.alumnoWidth).toBe(width);
      expect(menu.navWidth).toBe(232);
      expect(menu.navPos).toBe('fixed');
      expect(menu.menuCols).toBe(4);

      await page.getByRole('button', { name: /chocolate frío/i }).click();
      const sheet = await metrics(page);
      expect(sheet.sheetMax).toBe('none');
      expect(sheet.dialogWidth).toBeGreaterThan(700);
      expect(sheet.dialogWidth).toBeLessThanOrEqual(960);
      await page.getByRole('button', { name: /cerrar/i }).click();
    }

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/e/demo-a');
    await expect(page.getByRole('heading', { name: /cafetería demo a/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /chocolate frío/i }).click();
    await page.getByRole('button', { name: /agregar/i }).click();
    await page.goto('/e/demo-a/carrito');
    await expect(page.getByRole('heading', { name: /tu pedido/i })).toBeVisible();
    const cart = await metrics(page);
    expect(cart.cartCols).toBe(2);

    const pay = await page.evaluate(() => {
      const sheet = document.createElement('div');
      sheet.className = 'alumno-sheet alumno-sheet--pay';
      const panel = document.createElement('div');
      panel.className = 'alumno-sheet__panel';
      sheet.appendChild(panel);
      document.body.appendChild(sheet);
      const style = getComputedStyle(panel);
      const result = { maxWidth: style.maxWidth, width: style.width };
      sheet.remove();
      return result;
    });
    expect(pay.maxWidth).toBe('560px');

    await page.goto('/pedir');
    await expect(page.getByRole('heading', { name: /dónde comes hoy/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continuar/i })).toBeVisible({ timeout: 20_000 });
    const discovery = await metrics(page);
    expect(discovery.discoveryCols).toBe(2);

    await page.goto('/cuenta');
    await expect(page.getByRole('heading', { name: /tu cafetería, a tu ritmo/i })).toBeVisible();
    const splash = await metrics(page);
    expect(splash.splashCols).toBeLessThanOrEqual(1);
    expect(splash.hasAlumnoNav).toBe(false);

    await page.goto('/demo-a/m/bad-token');
    await expect(page.getByRole('link', { name: /elegir cafetería/i })).toBeVisible({ timeout: 20_000 });
  });

  test('marketing no usa nav de alumno', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    const home = await metrics(page);
    expect(home.hasAlumnoNav).toBe(false);
    expect(home.hasMarketingNav).toBe(true);
    await page.goto('/soporte');
    const support = await metrics(page);
    expect(support.hasAlumnoNav).toBe(false);
    expect(support.hasMarketingNav).toBe(true);
  });
});
