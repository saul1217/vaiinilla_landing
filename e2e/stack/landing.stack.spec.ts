// QA-046: la landing de punta a punta contra el stack local de CI (QA-044), solo Chromium.
import { expect, test } from '@playwright/test';
import { openVerificationLink, placeTableOrder, seeded, verificationLink } from './stack';

test('registro con correo: el enlace del emulador verifica y recién entonces se da el alta (QA-042)', async ({
  page,
}) => {
  const email = `e2e-${Date.now().toString(36)}@example.test`;
  const requests: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/publico/correos/verificacion')) requests.push('correo');
    if (url.includes('/identidad/alta')) requests.push('alta');
  });

  await page.goto('/cuenta');
  await page.getByRole('button', { name: /crear cuenta con correo/i }).click();
  await page.getByLabel('Correo').fill(email);
  await page.getByRole('button', { name: /^continuar$/i }).click();
  await page.getByLabel('Contraseña', { exact: true }).fill('Contrasena-E2E-1');
  await page.getByRole('button', { name: /^continuar$/i }).click();
  await page.getByLabel('Nombre').fill('Persona E2E');
  await page.getByRole('button', { name: /^continuar$/i }).click();
  await page.getByLabel('Acepto los términos y condiciones').check();
  await page.getByLabel('Acepto el aviso de privacidad').check();
  await page.getByRole('button', { name: /^crear cuenta$/i }).click();

  await expect(page.getByRole('heading', { name: /verifica tu correo/i })).toBeVisible({ timeout: 20_000 });
  // QA-042: antes de verificar solo sale el correo; el alta en el backend todavía no se pide.
  expect(requests).toEqual(['correo']);
  await expect.poll(() => verificationLink(email), { timeout: 15_000 }).not.toBeNull();

  // Sin abrir el enlace, la app lo dice y no da de alta.
  await page.getByRole('button', { name: /ya verifiqué mi correo/i }).click();
  await expect(page.getByRole('alert')).toContainText(/aún no vemos tu correo verificado/i);
  expect(requests).toEqual(['correo']);

  await openVerificationLink((await verificationLink(email)) as string);
  const alta = page.waitForResponse((response) => response.url().includes('/identidad/alta'));
  await page.getByRole('button', { name: /ya verifiqué mi correo/i }).click();
  expect((await alta).ok(), 'el alta se acepta con el correo ya verificado').toBe(true);
  await expect(page.getByRole('heading', { name: /verifica tu correo/i })).toBeHidden({ timeout: 20_000 });
  expect(requests).toEqual(['correo', 'alta']);
});

test('registro con un correo que ya tiene cuenta: aviso amigable en el paso del correo (QA-053)', async ({
  page,
}) => {
  const email = `e2e-dup-${Date.now().toString(36)}@example.test`;
  const register = async () => {
    await page.goto('/cuenta');
    await page.getByRole('button', { name: /crear cuenta con correo/i }).click();
    await page.getByLabel('Correo').fill(email);
    await page.getByRole('button', { name: /^continuar$/i }).click();
    await page.getByLabel('Contraseña', { exact: true }).fill('Contrasena-E2E-1');
    await page.getByRole('button', { name: /^continuar$/i }).click();
    await page.getByLabel('Nombre').fill('Persona E2E');
    await page.getByRole('button', { name: /^continuar$/i }).click();
    await page.getByLabel('Acepto los términos y condiciones').check();
    await page.getByLabel('Acepto el aviso de privacidad').check();
    await page.getByRole('button', { name: /^crear cuenta$/i }).click();
  };

  await register();
  await expect(page.getByRole('heading', { name: /verifica tu correo/i })).toBeVisible({ timeout: 20_000 });

  // Segundo intento con el mismo correo: Firebase responde email-already-in-use.
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await register();

  await expect(page.getByText(/este correo ya tiene una cuenta/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel('Correo')).toHaveValue(email);
  await expect(page.getByRole('button', { name: 'Recuperar contraseña' })).toBeVisible();
  await expect(page.getByText(/firebase: error/i)).toBeHidden();
});

test('pedido en mesa: el invitado pide, paga en caja y lo ve en Mis pedidos', async ({ page }) => {
  await placeTableOrder(page);
  await expect(page.getByRole('heading', { name: /mis pedidos/i })).toBeVisible();
  await expect(page.getByText(/aún no has hecho pedidos/i)).toBeHidden();
  await expect(page.getByText(new RegExp(seeded().product, 'i')).first()).toBeVisible({ timeout: 20_000 });
});

test('«Mis pedidos» del invitado se limpia cuando el pedido ya no existe (QA-033)', async ({ page }) => {
  const { token } = await placeTableOrder(page);
  const { slug } = seeded();
  const savedTokens = () =>
    page.evaluate(
      () =>
        (JSON.parse(localStorage.getItem('vaiinilla.buyer.guest-orders.v1') ?? '[]') as { token: string }[]).map(
          (order) => order.token,
        ),
    );
  expect(await savedTokens()).toContain(token);

  // El pedido real deja de existir: el seguimiento responde 404 y ya no hay pedidos en vivo.
  await page.route('**/publico/seguimiento/**', (route) =>
    route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Pedido no encontrado' } } }),
  );
  await page.route('**/publico/invitados/pedidos**', (route) => route.fulfill({ json: { data: [] } }));

  await page.goto(`/cuenta/pedidos?nuevo=${token}`);
  await expect(page.getByText('Este pedido ya no está disponible.')).toBeVisible({ timeout: 20_000 });
  await expect.poll(savedTokens).not.toContain(token);

  await page.goto(`/e/${slug}`);
  await expect(page.getByRole('link', { name: /tu pedido #\d+/i })).toHaveCount(0);
});

test('Olvidé mi contraseña manda continue_url con sand-user, no el panel ni el preview (QA-057)', async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  await page.route('**/publico/correos/recuperacion', (route) => {
    bodies.push(route.request().postDataJSON() as Record<string, unknown>);
    return route.fulfill({ status: 202, json: { data: { aceptado: true } } });
  });

  await page.goto('/cuenta');
  await page.getByRole('button', { name: /entrar a mi cuenta/i }).click();
  await page.getByLabel(/correo/i).fill(' Persona@Example.test ');
  await page.getByRole('button', { name: /¿la olvidaste\?/i }).click();

  await expect(page.getByText(/si la cuenta existe, te enviamos un enlace/i)).toBeVisible();
  expect(bodies).toEqual([{ email: 'persona@example.test', continue_url: 'https://sand-user.vaiinilla.app/cuenta' }]);
});
