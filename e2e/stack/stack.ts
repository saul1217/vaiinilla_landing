// Utilidades de las pruebas contra el stack local de CI (QA-044). Sin buzón de paga: el enlace de
// verificación sale de la API del emulador de Auth.
import { expect, type Page } from '@playwright/test';

export const authEmulator = process.env.E2E_AUTH_EMULATOR_URL ?? 'http://127.0.0.1:9099';
export const projectId = process.env.E2E_FIREBASE_PROJECT_ID ?? 'demo-vaiinilla';

/** Datos sembrados por las migraciones del stack; sin ellos la prueba falla con un mensaje claro. */
export function seeded() {
  const slug = process.env.E2E_PLACE_SLUG;
  const qrToken = process.env.E2E_TABLE_QR_TOKEN;
  const product = process.env.E2E_PRODUCT_NAME;
  if (!slug || !qrToken || !product) {
    throw new Error('Faltan E2E_PLACE_SLUG, E2E_TABLE_QR_TOKEN y E2E_PRODUCT_NAME del stack de CI.');
  }
  return { slug, qrToken, product };
}

interface OobCode {
  email: string;
  requestType: string;
  oobLink: string;
}

/** Enlace de verificación más reciente del correo, leído del emulador de Auth. */
export async function verificationLink(email: string): Promise<string | null> {
  const response = await fetch(`${authEmulator}/emulator/v1/projects/${projectId}/oobCodes`);
  if (!response.ok) throw new Error(`El emulador de Auth respondió ${response.status}.`);
  const { oobCodes } = (await response.json()) as { oobCodes: OobCode[] };
  const mine = oobCodes.filter((code) => code.requestType === 'VERIFY_EMAIL' && code.email === email);
  return mine.length > 0 ? mine[mine.length - 1].oobLink : null;
}

/** Abrir el enlace en el emulador equivale a que la persona lo toque en su correo. */
export async function openVerificationLink(link: string): Promise<void> {
  const response = await fetch(link, { redirect: 'manual' });
  expect(response.status, 'el emulador acepta el enlace de verificación').toBeLessThan(400);
}

/** Entra a la mesa sembrada y pide un producto como invitado, pagando en caja. */
export async function placeTableOrder(page: Page): Promise<{ token: string }> {
  const { slug, qrToken, product } = seeded();
  const alias = `E2E ${Date.now().toString(36)}`;

  await page.goto(`/e/${slug}/m/${qrToken}`);
  const aliasInput = page.getByPlaceholder('Por ejemplo, Ana o José');
  const addMe = page.getByRole('button', { name: /agregarme a la mesa/i });
  await expect(aliasInput.or(addMe)).toBeVisible({ timeout: 20_000 });
  if (await addMe.isVisible()) await addMe.click();
  await aliasInput.fill(alias);
  await page.getByRole('button', { name: /^entrar$/i }).click();

  await expect(page).toHaveURL(new RegExp(`/e/${slug}$`), { timeout: 20_000 });
  await page.getByRole('button', { name: new RegExp(product, 'i') }).first().click();
  await page.getByRole('button', { name: /^agregar/i }).click();

  await page.getByRole('link', { name: 'Carrito' }).click();
  await expect(page.getByRole('heading', { name: /tu pedido/i })).toBeVisible();
  await page.getByRole('button', { name: /^continuar$/i }).click();

  const guestName = page.getByPlaceholder('Para que sepan de quién es el pedido');
  if (await guestName.isVisible()) await guestName.fill(alias);
  await page.getByText('Pago en caja', { exact: true }).click();
  await page.getByRole('button', { name: /continuar con pago en caja/i }).click();

  await expect(page).toHaveURL(/\/cuenta\/pedidos\?nuevo=/, { timeout: 30_000 });
  const token = new URL(page.url()).searchParams.get('nuevo');
  expect(token, 'el pedido devuelve su token de seguimiento').toBeTruthy();
  return { token: token as string };
}
