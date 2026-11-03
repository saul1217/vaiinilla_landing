import { expect, test } from "@playwright/test";

test("reconfirma participante al confirmar y crea el pedido en la mesa", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const joins: unknown[] = [];
  const orders: Record<string, unknown>[] = [];
  await page.addInitScript(() => {
    if (sessionStorage.getItem("e2e.seeded")) return;
    sessionStorage.setItem("e2e.seeded", "1");
    sessionStorage.setItem("vaiinilla.buyer.guest-buy.v1", "1");
    sessionStorage.setItem("vaiinilla.buyer.guest-explore.v1", "1");
    localStorage.setItem(
      "vaiinilla.buyer.guest.v1",
      JSON.stringify({ nombre: "Ana", llave: "L".repeat(43) }),
    );
    localStorage.setItem(
      "vaiinilla.buyer.cart.v1",
      JSON.stringify({
        slug: "demo",
        establishmentName: "Demo",
        lines: [
          {
            productId: 1,
            quantity: 1,
            optionIds: [],
            productName: "Agua",
            unitPreview: "30.00",
            imageUrl: null,
          },
        ],
      }),
    );
  });
  await page.route("**/publico/invitados/sesiones", (route) =>
    route.fulfill({
      json: {
        data: {
          access_token: "guest-jwt",
          token_type: "Bearer",
          expires_in: 900,
          contexto: { establecimiento_id: "e1", rol: "cliente" },
          invitado: { nombre: "Ana" },
        },
      },
    }),
  );
  await page.route("**/espacios/resolver", (route) =>
    route.fulfill({
      json: {
        data: {
          establecimiento_slug: "demo",
          espacio_id: 12,
          espacio_nombre: "Mesa 12",
          espacio_tipo: "mesa",
        },
      },
    }),
  );
  await page.route("**/establecimientos/demo", (route) =>
    route.fulfill({
      json: {
        data: { id: "e1", nombre: "Demo", permite_pago_al_final: false },
      },
    }),
  );
  let currentCalls = 0;
  let nullNext = false;
  let nullServed = 0;
  await page.route("**/mesas/actual", (route) => {
    currentCalls += 1;
    const transientNull = nullNext;
    if (transientNull) {
      nullNext = false;
      nullServed += 1;
    }
    return route.fulfill({
      json: {
        data: transientNull
          ? null
          : {
              espacio: { id: 12, nombre: "Mesa 12", tipo: "mesa" },
              sesion_id: "s12",
              mi_alias: "Ana",
              mi_participante: { id: "p12", alias: "Ana" },
              cuenta_abierta: true,
              participantes: [
                { id: "p12", alias: "Ana", soy_yo: true, unido_en: null },
              ],
              grupos: [],
              totales: { total: "0", pagado: "0", pendiente: "0" },
              mi_parte: { total: "0", pagado: "0", pendiente: "0" },
            },
      },
    });
  });
  await page.route("**/mesas/espacio/**", (route) =>
    route.fulfill({
      json: {
        data: {
          espacio: { id: 12, nombre: "Mesa 12", tipo: "mesa" },
          sesion_id: "s12",
          participantes: [{ id: "p12", alias: "Ana", soy_yo: false }],
          yo: { id: "p12", alias: "Ana" },
        },
      },
    }),
  );
  await page.route("**/mesas/unirse", async (route) => {
    joins.push(route.request().postDataJSON());
    await route.fulfill({
      json: {
        data: {
          espacio: { id: 12, nombre: "Mesa 12", tipo: "mesa" },
          sesion_id: "s12",
          mi_alias: "Ana",
          mi_participante: { id: "p12", alias: "Ana" },
          cuenta_abierta: true,
          participantes: [
            { id: "p12", alias: "Ana", soy_yo: true, unido_en: null },
          ],
          grupos: [],
          totales: { total: "0", pagado: "0", pendiente: "0" },
          mi_parte: { total: "0", pagado: "0", pendiente: "0" },
        },
      },
    });
  });
  await page.route("**/pedidos", async (route) => {
    // /publico/invitados/pedidos lista pedidos del invitado; solo /api/v1/pedidos crea uno.
    if (
      route.request().method() !== "POST" ||
      new URL(route.request().url()).pathname !== "/api/v1/pedidos"
    )
      return route.fulfill({ json: { data: [] } });
    orders.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      json: {
        data: {
          id: "order-1",
          folio: 1,
          estado: "por_cobrar",
          metodo_pago: "efectivo",
          destino: "en_espacio",
          espacio: { id: 12, nombre: "Mesa 12", tipo: "mesa" },
          total: "30.00",
          items: [],
        },
      },
    });
  });
  await page.route("**/estado-operativo", (route) =>
    route.fulfill({
      json: {
        data: {
          recibiendo_pedidos: true,
          sesion_caja_abierta: true,
          caja_en_linea: true,
          cocina_en_linea: true,
          permite_pago_al_final: false,
        },
      },
    }),
  );
  await page.route("**/productos/**", (route) =>
    route.fulfill({ json: { data: [] } }),
  );
  await page.route("**/reservas*", (route) =>
    route.fulfill({ json: { data: [] } }),
  );
  await page.route("**/wallets/me", (route) =>
    route.fulfill({
      json: { data: { cliente: {}, wallet: {}, movimientos: [] } },
    }),
  );
  await page.route("**/publico/legal/vigente", (route) =>
    route.fulfill({
      json: {
        data: { terminos: { version: "v1" }, privacidad: { version: "v1" } },
      },
    }),
  );
  await page.route("**/llamadas?**", (route) =>
    route.fulfill({ json: { data: [] } }),
  );
  await page.route("**/publico/establecimientos/demo/catalogo", (route) =>
    route.fulfill({ json: { data: { categorias: [], productos: [] } } }),
  );

  // Escanear QR y confirmar por primera vez quién es Ana.
  await page.goto("/e/demo/m/esp_demo");
  await expect(page).toHaveURL(/\/quien\?/);
  await expect(
    page.getByRole("button", { name: "Continuar como Ana" }),
  ).toBeVisible();
  expect(joins).toHaveLength(0);
  await page.getByRole("button", { name: "Continuar como Ana" }).click();
  await expect(page).toHaveURL(/\/e\/demo$/);
  await expect.poll(() => joins.length).toBe(1);

  // La recarga conserva la identidad y la mesa. /mesas/actual es válido al cargar;
  // la verificación que acompaña al botón Continuar es la única respuesta null.
  await page.goto("/e/demo/carrito");
  const continueWithoutAccount = page.getByRole("button", {
    name: /continuar sin cuenta/i,
  });
  if (await continueWithoutAccount.isVisible().catch(() => false)) {
    await continueWithoutAccount.click();
    await expect(page).toHaveURL(/\/e\/demo$/);
    await page.getByRole("link", { name: "Carrito" }).click();
  }
  await expect(page.getByRole("heading", { name: /tu pedido/i })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^continuar$/i }),
  ).toContainText(/mesa 12/i);
  await page.getByRole("button", { name: /^continuar$/i }).click();
  nullNext = true;
  await page
    .getByRole("button", { name: /continuar con pago en caja/i })
    .click();
  await expect(page).toHaveURL(/\/quien\?/);
  await expect(
    page
      .getByRole("status")
      .getByText("Vuelve a confirmar quién eres en la mesa."),
  ).toBeVisible();
  expect(nullServed).toBe(1);
  expect(orders).toHaveLength(0);
  expect(joins).toHaveLength(1);

  await page.getByRole("button", { name: "Continuar como Ana" }).click();
  // next= devuelve al carrito sin recargar: conserva mesa e identidad reconfirmadas.
  await expect(page).toHaveURL(/\/e\/demo\/carrito$/);
  await expect.poll(() => joins.length).toBe(2);
  await expect(page.getByRole("heading", { name: /tu pedido/i })).toBeVisible();
  await page.getByRole("button", { name: /^continuar$/i }).click();
  await page
    .getByRole("button", { name: /continuar con pago en caja/i })
    .click();
  await expect.poll(() => orders.length).toBe(1);
  expect(orders[0]).toMatchObject({ destino: "en_espacio", espacio_id: 12 });
});
