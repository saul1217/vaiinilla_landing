import { expect, test, type Page } from '@playwright/test';

async function openCart(page: Page, space?: { slug: string; espacioId: number; nombre: string; tipo: string }, theme: 'light' | 'dark' = 'light') {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(({ savedSpace, theme }) => {
    sessionStorage.setItem('vaiinilla.buyer.guest-buy.v1', '1');
    sessionStorage.setItem('vaiinilla.buyer.guest-explore.v1', '1');
    localStorage.setItem('vaiinilla.buyer.guest.v1', JSON.stringify({ nombre: 'Ana', llave: 'L'.repeat(43) }));
    localStorage.setItem('vaiinilla.buyer.theme.v1', theme);
    localStorage.setItem('vaiinilla.buyer.cart.v1', JSON.stringify({
      slug: 'demo', establishmentName: 'Demo',
      lines: [{ productId: 1, quantity: 1, optionIds: [], productName: 'Agua', unitPreview: '30.00', imageUrl: null }],
    }));
    if (savedSpace) localStorage.setItem('vaiinilla.buyer.space.v1', JSON.stringify(savedSpace));
  }, { savedSpace: space ?? null, theme });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('/publico/establecimientos/demo/catalogo')) return route.fulfill({ json: { data: { categorias: [], productos: [] } } });
    if (url.pathname.includes('/estado-operativo')) return route.fulfill({ json: { data: { recibiendo_pedidos: true, sesion_caja_abierta: true, caja_en_linea: true, cocina_en_linea: true, permite_pago_al_final: false } } });
    if (url.pathname.includes('/establecimientos/demo')) return route.fulfill({ json: { data: { id: 'e1', slug: 'demo', nombre: 'Demo', permite_pago_al_final: false } } });
    if (url.pathname.includes('/publico/invitados/sesiones')) return route.fulfill({ json: { data: { access_token: 'guest-jwt', token_type: 'Bearer', expires_in: 900, contexto: { establecimiento_id: 'e1', rol: 'cliente' }, invitado: { nombre: 'Ana' } } } });
    if (url.pathname.includes('/publico/legal/vigente')) return route.fulfill({ json: { data: { terminos: { version: 'v1' }, privacidad: { version: 'v1' } } } });
    if (url.pathname.includes('/productos/') || url.pathname.includes('/catalogo') || url.pathname.includes('/reservas') || url.pathname.includes('/wallets/') || url.pathname.includes('/pedidos') || url.pathname.includes('/llamadas')) return route.fulfill({ json: { data: [] } });
    return route.continue();
  });
  await page.goto('/e/demo/carrito');
  await expect(page.locator('.alumno-cart-destination')).toBeVisible();
}

test('sin mesa: la tarjeta invita a escribir el código y abre PlaceEntry al tocar y con teclado', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openCart(page);
  const card = page.locator('.alumno-cart-destination');
  await expect(card).toHaveAccessibleName(/Para llevar.*¿Estás en una mesa\? Escribe su código/i);
  await expect(card).toContainText('Para llevar · ¿Estás en una mesa? Escribe su código');
  await expect(page.locator('.alumno-cart-join-help')).toBeVisible();
  if (process.env.CART_SCREENSHOTS) {
    await page.locator('.alumno-cart-join-help').evaluate((node) => node.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: '/workspace/vaiinilla-pm/carrito-1103/despues/continuar-sin-mesa.png' });
  }
  await card.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  if (process.env.CART_SCREENSHOTS) {
    await card.locator('p').evaluate((node) => { node.textContent = 'Recoges en mostrador cuando esté listo.'; });
    await page.screenshot({ path: '/workspace/vaiinilla-pm/carrito-1103/antes/carrito-sin-mesa.png' });
    await card.locator('p').evaluate((node) => { node.textContent = 'Para llevar · ¿Estás en una mesa? Escribe su código'; });
  }
  await card.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  if (process.env.CART_SCREENSHOTS) await page.screenshot({ path: '/workspace/vaiinilla-pm/carrito-1103/despues/carrito-con-codigo.png' });
  await page.getByRole('button', { name: /cancelar/i }).click();
  await card.focus();
  await expect(card).toBeFocused();
  await card.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: /cancelar/i }).click();
  await card.focus();
  await card.press('Space');
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('el aviso para unirse a la mesa no bloquea Continuar sin mesa', async ({ page }) => {
  await openCart(page);
  await expect(page.locator('.alumno-cart-join-help')).toBeVisible();
  const continueButton = page.getByRole('button', { name: /^Continuar/ });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('vista QA conserva su tarjeta de muestra sin activar PlaceEntry', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/__qa/carrito-lleno');
  await expect(page.getByRole('heading', { name: 'Tu pedido' })).toBeVisible();
  await expect(page.getByText('CI Bebida de prueba').first()).toBeVisible();
  await expect(page.getByText('CI Tacos de prueba').first()).toBeVisible();
  const destination = page.locator('.alumno-cart-destination');
  await expect(destination).toContainText('Para llevar');
  await destination.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('capturas QA: menú y carrito en claro y oscuro a 390×844', async ({ page }) => {
  test.skip(!process.env.CART_QA_SCREENSHOTS, 'Capturas QA se generan bajo demanda.');
  const fs = await import('node:fs/promises');
  const output = '/workspace/vaiinilla-pm/carrito-1103/despues-qa';
  await fs.mkdir(output, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });

  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.addInitScript((selectedTheme) => {
      localStorage.setItem('vaiinilla.buyer.theme.v1', selectedTheme);
      sessionStorage.setItem('vaiinilla.buyer.guest-explore.v1', '1');
    }, theme);
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.includes('/publico/establecimientos/demo/catalogo')) return route.fulfill({ json: { data: { categorias: [], productos: [] } } });
      if (url.pathname.includes('/publico/establecimientos/demo')) return route.fulfill({ json: { data: { id: 'e1', slug: 'demo', nombre: 'Demo', permite_pago_al_final: false } } });
      if (url.pathname.includes('/llamadas') || url.pathname.includes('/reservas')) return route.fulfill({ json: { data: [] } });
      return route.continue();
    });
    await page.goto('/e/demo');
    const banner = page.locator('.alumno-join-table');
    await expect(banner).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const bannerVisible = await banner.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const text = element.querySelector('span')!.getBoundingClientRect();
      const x = Math.max(0, Math.min(innerWidth - 1, text.left + 2));
      const y = Math.max(0, Math.min(innerHeight - 1, text.top + text.height / 2));
      return rect.top >= 0 && rect.bottom <= innerHeight && document.elementFromPoint(x, y)?.closest('.alumno-join-table') === element;
    });
    expect(bannerVisible).toBe(true);
    await page.screenshot({ path: `${output}/menu-${theme}.png` });

    await openCart(page, undefined, theme);
    const destination = page.locator('.alumno-cart-destination');
    await destination.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/cart-closed-${theme}.png` });
    await page.locator('.alumno-sticky-pay').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/continuar-${theme}.png` });
    await destination.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.screenshot({ path: `${output}/cart-code-open-${theme}.png` });
  }
});

test('con mesa: conserva el cambio de destino existente', async ({ page }) => {
  await openCart(page, { slug: 'demo', espacioId: 12, nombre: 'Mesa 12', tipo: 'mesa' });
  const card = page.locator('.alumno-cart-destination');
  await expect(card).toContainText('Mesa 12');
  await expect(page.locator('.alumno-cart-join-help')).toHaveCount(0);
  await expect(card).toContainText(/Toca para cambiar a para llevar/);
  await card.click();
  await expect(card).toContainText('Para llevar');
  await expect(page.locator('.alumno-cart-join-help')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('para llevar sigue siendo un destino válido sin abrir un flujo nuevo', async ({ page }) => {
  await openCart(page, { slug: 'demo', espacioId: 12, nombre: 'Mesa 12', tipo: 'mesa' });
  const card = page.locator('.alumno-cart-destination');
  await expect(card).toContainText('Mesa 12');
  await card.click();
  await expect(card).toContainText('Para llevar');
  await expect(page.locator('.alumno-cart-join-help')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(card).toContainText('Para llevar');
  await expect(page.locator('.alumno-sticky-pay')).toBeVisible();
  await expect(page.locator('.alumno-sticky-pay')).toContainText('Para llevar');
});

test('menú: el aviso aparece sin mesa y se oculta al asociar una mesa', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    sessionStorage.setItem('vaiinilla.buyer.guest-explore.v1', '1');
  });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('/publico/establecimientos/demo/catalogo')) return route.fulfill({ json: { data: { categorias: [], productos: [] } } });
    if (url.pathname.includes('/publico/establecimientos/demo')) return route.fulfill({ json: { data: { id: 'e1', slug: 'demo', nombre: 'Demo', permite_pago_al_final: false } } });
    if (url.pathname.includes('/llamadas') || url.pathname.includes('/reservas')) return route.fulfill({ json: { data: [] } });
    return route.continue();
  });
  await page.goto('/e/demo');
  const notice = page.getByRole('note').filter({ hasText: '¿Estás en el local?' });
  await expect(notice).toBeVisible();
  if (process.env.CART_SCREENSHOTS) await page.screenshot({ path: '/workspace/vaiinilla-pm/carrito-1103/despues/menu-sin-mesa.png' });
  await notice.getByRole('button', { name: 'Escribir código' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: /cancelar/i }).click();
  await page.evaluate(() => localStorage.setItem('vaiinilla.buyer.space.v1', JSON.stringify({ slug: 'demo', espacioId: 12, nombre: 'Mesa 12', tipo: 'mesa' })));
  await page.reload();
  await expect(page.getByRole('note').filter({ hasText: '¿Estás en el local?' })).toHaveCount(0);
  await expect(page.locator('.alumno-table-chip')).toContainText('Mesa 12');
});
