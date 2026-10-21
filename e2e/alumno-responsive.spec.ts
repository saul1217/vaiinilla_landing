import { expect, test, type Page } from '@playwright/test';
import { CI_CART_URL_RE, CI_MENU_URL, CI_PLACE_NAME, CI_PLACE_NAME_RE, CI_SLUG } from './ci-store';

// El selector de lugar ya no tiene botón «Continuar»: con la tienda de CI listada aparece «Entrar al menú».
async function waitForDiscovery(page: Page) {
  await expect(page.getByRole('heading', { name: /dónde comes hoy/i })).toBeVisible();
  await page.getByRole('textbox', { name: /buscar establecimiento/i }).fill(CI_PLACE_NAME);
  await expect(page.getByRole('radiogroup', { name: /establecimientos/i }).getByRole('radio').first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole('button', { name: /entrar al menú/i })).toBeVisible();
}

async function waitForCiMenu(page: Page) {
  await expect(page.getByRole('heading', { level: 1, name: CI_PLACE_NAME_RE })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.alumno-grid button').first()).toBeVisible({ timeout: 20_000 });
}

async function openFirstProduct(page: Page) {
  await page.locator('.alumno-grid button').first().click();
  await expect(page.locator('.alumno-sheet.alumno-psheet')).toBeVisible();
}

async function metrics(page: Page) {
  return page.evaluate(() => {
    const shell = document.querySelector('.alumno');
    const nav = document.querySelector('.alumno-nav');
    const grid = document.querySelector('.alumno-grid');
    const discovery = document.querySelector('.alumno-discovery');
    const cart = document.querySelector('.alumno-cart-layout');
    const splash = document.querySelector('.alumno-splash');
    const sheet = document.querySelector('.alumno-sheet');
    const dialog = document.querySelector('.alumno-sheet .alumno-motion-panel');
    const brand = document.querySelector('.alumno-nav__brand');
    const utility = document.querySelector('.alumno-deskhead__utility');
    const utilityActions = document.querySelector('.alumno-deskhead__utility .alumno-top__actions');
    const utilitySearch = document.querySelector('.alumno-deskhead__utility .alumno-search-wrap');
    const cs = (el: Element | null) => (el ? getComputedStyle(el) : null);
    const navRect = nav?.getBoundingClientRect();
    const utilityActionsRect = utilityActions?.getBoundingClientRect();
    const utilitySearchRect = utilitySearch?.getBoundingClientRect();
    const cols = (value: string | undefined) =>
      value ? value.split(' ').filter((part) => part && part !== 'none').length : 0;
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      alumnoWidth: shell ? Math.round(shell.getBoundingClientRect().width) : 0,
      alumnoMax: cs(shell)?.maxWidth ?? null,
      navWidth: nav ? Math.round(nav.getBoundingClientRect().width) : 0,
      navInsetLeft: navRect ? Math.round(navRect.left) : 0,
      navInsetRight: navRect ? Math.round(window.innerWidth - navRect.right) : 0,
      navPos: cs(nav)?.position ?? null,
      navWidthCss: cs(nav)?.width ?? null,
      brandDisplay: brand ? cs(brand)?.display : null,
      utilityDisplay: utility ? cs(utility)?.display : null,
      utilityActionSearchGap:
        utilityActionsRect && utilitySearchRect ? Math.round(utilitySearchRect.top - utilityActionsRect.bottom) : null,
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

async function authMetrics(page: Page) {
  return page.evaluate(() => {
    const auth = document.querySelector('.alumno-auth');
    const mosaic = document.querySelector('.alumno-auth__mosaic');
    const panel = document.querySelector('.alumno-auth__panel');
    const windowLogo = document.querySelector('.alumno-auth__window-logo');
    const rect = panel?.getBoundingClientRect();
    return {
      authWidth: auth ? Math.round(auth.getBoundingClientRect().width) : 0,
      mosaicDisplay: mosaic ? getComputedStyle(mosaic).display : null,
      panelWidth: rect ? Math.round(rect.width) : 0,
      panelOffset: rect ? Math.round(Math.abs(rect.left - (window.innerWidth - rect.width) / 2)) : 0,
      windowLogoDisplay: windowLogo ? getComputedStyle(windowLogo).display : null,
      hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
}

test.describe('alumno responsive', () => {
  test('móvil 390: shell completo, nav compacta y menú de 2 columnas', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => sessionStorage.setItem('vaiinilla.buyer.guest-explore.v1', '1'));
    await page.goto('/pedir');
    await waitForDiscovery(page);
    const discovery = await metrics(page);
    expect(discovery.alumnoMax).toBe('none');
    expect(discovery.alumnoWidth).toBe(390);
    expect(discovery.navInsetLeft).toBe(14);
    expect(discovery.navInsetRight).toBe(14);
    expect(discovery.navPos).toBe('fixed');
    expect(discovery.brandDisplay).toBe('none');
    expect(discovery.hasDevice).toBe(false);

    await page.goto(CI_MENU_URL);
    await waitForCiMenu(page);
    const menu = await metrics(page);
    expect(menu.menuCols).toBe(2);
    await openFirstProduct(page);
    const sheet = await metrics(page);
    expect(sheet.sheetMax).toBe('none');
    expect(sheet.dialogWidth).toBe(menu.clientWidth);
  });

  test('tablet 850: top bar full-bleed y menú 3 columnas', async ({ page }) => {
    await page.setViewportSize({ width: 850, height: 1024 });
    await page.addInitScript(() => sessionStorage.setItem('vaiinilla.buyer.guest-explore.v1', '1'));
    await page.goto(CI_MENU_URL);
    await waitForCiMenu(page);
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
      await page.goto(CI_MENU_URL);
      await waitForCiMenu(page);
      const menu = await metrics(page);
      expect(menu.alumnoWidth).toBe(width);
      expect(menu.navWidth).toBe(232);
      expect(menu.navPos).toBe('fixed');
      expect(menu.menuCols).toBe(width >= 1440 ? 5 : 4);

      await openFirstProduct(page);
      const sheet = await metrics(page);
      expect(sheet.sheetMax).toBe('none');
      // Desde 768 px la ficha es un modal centrado de min(540px, 100vw − 48px) (alumno.css, @media min-width: 768px),
      // no una hoja de pantalla completa como en el teléfono.
      expect(sheet.dialogWidth).toBeGreaterThan(480);
      expect(sheet.dialogWidth).toBeLessThanOrEqual(540);
      expect(sheet.dialogWidth).toBeLessThan(width / 2);
      await page.getByRole('button', { name: /cerrar/i }).click();
    }

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(CI_MENU_URL);
    await waitForCiMenu(page);
    await openFirstProduct(page);
    // «Comprar sin cuenta» ya solo vive en /cuenta; con la exploración de invitado la ficha agrega directo.
    await page.getByRole('button', { name: /^agregar/i }).click();
    await page.locator('.alumno-top__actions').getByRole('link', { name: 'Carrito' }).click();
    await expect(page).toHaveURL(CI_CART_URL_RE);
    await expect(page.getByRole('heading', { name: /tu pedido/i })).toBeVisible();
    const cart = await metrics(page);
    expect(cart.cartCols).toBe(2);

    const pay = await page.evaluate(() => {
      const sheet = document.createElement('div');
      // Mismas clases que la hoja de pago real (cart-page.tsx): el panel es .alumno-codesheet__panel.
      sheet.className = 'alumno-sheet alumno-codesheet alumno-paysheet';
      const panel = document.createElement('div');
      panel.className = 'alumno-codesheet__panel';
      sheet.appendChild(panel);
      document.body.appendChild(sheet);
      const style = getComputedStyle(panel);
      const result = { maxWidth: style.maxWidth, width: style.width };
      sheet.remove();
      return result;
    });
    expect(pay.maxWidth).toBe('560px');

    await page.goto('/pedir');
    await waitForDiscovery(page);
    const discovery = await metrics(page);
    expect(discovery.discoveryCols).toBe(2);

    await page.goto('/cuenta');
    await expect(page.getByRole('heading', { name: /tu lugar, a tu ritmo/i })).toBeVisible();
    const splash = await metrics(page);
    expect(splash.splashCols).toBeLessThanOrEqual(1);
    expect(splash.hasAlumnoNav).toBe(false);

    await page.goto(`/${CI_SLUG}/m/bad-token`);
    await expect(page.getByRole('link', { name: /elegir lugar/i })).toBeVisible({ timeout: 20_000 });
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

  test('acciones de cabecera y acceso son utilizables en tablet y escritorio', async ({ page }) => {
    for (const width of [768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(CI_MENU_URL);

      const actions = page.locator('.alumno-top__actions');
      await expect(actions.getByRole('link', { name: 'Carrito' })).toBeVisible();
      const header = await metrics(page);
      expect(header.utilityDisplay).toBe('grid');
      expect(header.utilityActionSearchGap).toBe(8);
      await actions.getByRole('link', { name: 'Carrito' }).click();
      await expect(page).toHaveURL(CI_CART_URL_RE);

      await page.goto(CI_MENU_URL);
      await expect(actions.getByRole('link', { name: 'Cuenta' })).toBeVisible();
      await actions.getByRole('link', { name: 'Cuenta' }).click();
      await expect(page).toHaveURL(/\/cuenta$/);
      await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible();

      const auth = await authMetrics(page);
      expect(auth.authWidth).toBe(width);
      expect(auth.mosaicDisplay).toBe('none');
      expect(auth.panelWidth).toBeLessThanOrEqual(520);
      expect(auth.panelOffset).toBeLessThanOrEqual(1);
      expect(auth.windowLogoDisplay).toBe('block');
      expect(auth.hasHorizontalOverflow).toBe(false);
    }
  });

  test('móvil 390: el acceso conserva su mosaico y no muestra la ventana de escritorio', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/cuenta');
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible();

    const auth = await authMetrics(page);
    expect(auth.mosaicDisplay).toBe('grid');
    expect(auth.windowLogoDisplay).toBe('none');
    expect(auth.hasHorizontalOverflow).toBe(false);
  });
});
