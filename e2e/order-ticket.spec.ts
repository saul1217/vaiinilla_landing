import { expect, test } from '@playwright/test';

test.describe('ticket de mesa compartida', () => {
  test('el seguimiento sin cuenta reúne el pedido individual y la cuenta backend', async ({ page }) => {
    const trackingToken = 'S'.repeat(43);
    const guestKey = 'K'.repeat(43);
    await page.addInitScript(
      ({ trackingToken, guestKey }) => {
        localStorage.setItem('vaiinilla.buyer.guest.v1', JSON.stringify({ nombre: 'Kikin', llave: guestKey }));
        localStorage.setItem(
          'vaiinilla.buyer.guest-orders.v1',
          JSON.stringify([
            {
              token: trackingToken,
              slug: 'usagi',
              folio: 28,
              placeName: 'USAGI',
              createdAt: Date.now(),
            },
          ]),
        );
      },
      { trackingToken, guestKey },
    );

    await page.route('**/publico/invitados/sesiones', async (route) => {
      await route.fulfill({
        json: {
          data: {
            access_token: 'guest-access-token',
            token_type: 'Bearer',
            expires_in: 900,
            contexto: {
              usuario_id: 'guest-kikin',
              membresia_id: 'member-kikin',
              establecimiento_id: 'usagi-id',
              rol: 'cliente',
              modo_restringido: null,
            },
            invitado: { nombre: 'Kikin' },
          },
        },
      });
    });
    await page.route('**/publico/seguimiento/**', async (route) => {
      await route.fulfill({
        json: {
          data: {
            id: 'order-28',
            folio: 28,
            fecha_operativa: '2026-10-05',
            estado: 'cobrado',
            metodo_pago: 'efectivo',
            destino: 'en_espacio',
            espacio: { id: 67, nombre: 'Mesa 67', tipo: 'mesa' },
            subtotal: '50.00',
            ahorro_combinado: '0.00',
            cashback_otorgado: '0.00',
            total: '50.00',
            version: 1,
            creado_en: '2026-10-05T20:00:00Z',
            actualizado_en: '2026-10-05T20:00:00Z',
            notas_cocina: null,
            usuario: null,
            invitado: true,
            qr_token: null,
            items: [
              {
                id: 1,
                producto_id: 7,
                nombre_producto: 'Quesadilla',
                estacion_preparacion: 'cocina',
                cantidad: 1,
                precio_digital_unitario: '50.00',
                subtotal: '50.00',
                opciones: [],
              },
            ],
          },
        },
      });
    });
    await page.route('**/mesas/actual', async (route) => {
      expect(route.request().headers().authorization).toBe('Bearer guest-access-token');
      await route.fulfill({
        json: {
          data: {
            espacio: { id: 67, nombre: 'Mesa 67', tipo: 'mesa' },
            sesion_id: 'session-67',
            mi_alias: 'Kikin',
            mi_participante: { id: 'participant-kikin', alias: 'Kikin' },
            cuenta_abierta: true,
            participantes: [
              { id: 'participant-kikin', alias: 'Kikin', soy_yo: true, unido_en: null },
              { id: 'participant-david', alias: 'David', soy_yo: false, unido_en: null },
              { id: 'participant-david-r', alias: 'David R.', soy_yo: false, unido_en: null },
              { id: 'participant-miguel', alias: 'Miguel', soy_yo: false, unido_en: null },
            ],
            grupos: [
              {
                alias: 'Kikin',
                participante_id: 'participant-kikin',
                soy_yo: true,
                pedidos: [
                  { id: 'order-28', folio: 28, estado: 'cobrado', items_resumen: '1 × Quesadilla', total: '50.00', pendiente_cobro: true, creado_en: null },
                  { id: 'order-29', folio: 29, estado: 'cobrado', items_resumen: '1 × Agua', total: '20.00', pendiente_cobro: true, creado_en: null },
                ],
                total: '70.00',
                pagado: '0.00',
                pendiente: '70.00',
              },
              {
                alias: 'David',
                participante_id: 'participant-david',
                soy_yo: false,
                pedidos: [
                  { id: 'order-27', folio: 27, estado: 'cobrado', items_resumen: '1 × Agua', total: '20.00', pendiente_cobro: true, creado_en: null },
                ],
                total: '20.00',
                pagado: '0.00',
                pendiente: '20.00',
              },
            ],
            totales: { total: '90.00', pagado: '0.00', pendiente: '90.00' },
            mi_parte: { total: '70.00', pagado: '0.00', pendiente: '70.00' },
          },
        },
      });
    });

    await page.goto(`/seguimiento/${trackingToken}`);

    const ticket = page.locator('.alumno-card--ticket');
    await expect(ticket.getByRole('heading', { name: 'Cuenta de la mesa' })).toBeVisible();
    await expect(ticket.getByText(/1 × Quesadilla/)).toHaveCount(2);
    await expect(ticket.getByText('Pedido #29')).toBeVisible();
    await expect(ticket.getByRole('heading', { name: 'David' })).toHaveCount(1);
    await expect(ticket.getByRole('heading', { name: 'David R.' })).toHaveCount(0);
    await expect(ticket.getByRole('heading', { name: 'Miguel' })).toHaveCount(0);
    await expect(ticket.getByText('Total de la mesa', { exact: true }).locator('..')).toContainText('$90');
    await expect(ticket.getByText('Pagado', { exact: true }).locator('..')).toContainText('$0');
    await expect(ticket.getByText('Por pagar', { exact: true }).locator('..')).toContainText('$90');
    await expect(ticket.getByText('Tu parte por pagar', { exact: true }).locator('..')).toContainText('$70');
  });

  test('mantiene nombres y montos largos dentro del layout móvil', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 780 });
    await page.goto('/__qa/pedido-mesa');

    const ticket = page.locator('.alumno-card--ticket');
    await expect(ticket.getByRole('heading', { name: 'Cuenta de la mesa' })).toBeVisible();
    await expect(ticket.getByRole('heading', { name: 'Luis Fernando con otro alias largo' })).toBeVisible();
    await expect(ticket.getByText('$1264999.99')).toHaveCount(2);
    await expect(ticket.locator('.alumno-ticket-table__group')).toHaveCount(2);

    const layout = await page.evaluate(() => {
      const ticketElement = document.querySelector('.alumno-card--ticket');
      const viewportWidth = document.documentElement.clientWidth;
      const horizontalOverflow = document.documentElement.scrollWidth > viewportWidth;
      const clippedContent = Array.from(
        document.querySelectorAll(
          '.alumno-ticket-head__copy, .alumno-ticket-table__group h3, .alumno-ticket-table__order-copy > span',
        ),
      ).some((element) => element.scrollWidth > element.clientWidth + 1);
      const ticketHeader = document.querySelector('.alumno-ticket-head__copy');
      const ticketBounds = ticketElement?.getBoundingClientRect();
      return {
        horizontalOverflow,
        clippedContent,
        ticketHeaderWidth: ticketHeader?.getBoundingClientRect().width ?? 0,
        ticketInsideViewport:
          Boolean(ticketBounds) &&
          ticketBounds!.left >= 0 &&
          ticketBounds!.right <= viewportWidth + 1,
      };
    });

    expect(layout.horizontalOverflow).toBe(false);
    expect(layout.clippedContent).toBe(false);
    expect(layout.ticketHeaderWidth).toBeGreaterThan(180);
    expect(layout.ticketInsideViewport).toBe(true);
  });

  test('separa el resumen del estado y el subtotal en móvil, tablet y escritorio', async ({ page }) => {
    await page.goto('/__qa/pedido-mesa');
    await expect(page.locator('.alumno-card--ticket')).toBeVisible();

    for (const width of [320, 360, 375, 390, 414, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const layout = await page.evaluate(() => {
        const ticket = document.querySelector('.alumno-card--ticket');
        const orderCopy = document.querySelector('.alumno-ticket-table__order-copy');
        const summary = orderCopy?.querySelector(':scope > span');
        const status = orderCopy?.querySelector(':scope > small');
        const subtotal = document.querySelector('.alumno-ticket-table__subtotal');
        const subtotalLabel = subtotal?.querySelector(':scope > span');
        const subtotalAmount = subtotal?.querySelector(':scope > strong');
        const summaryBounds = summary?.getBoundingClientRect();
        const statusBounds = status?.getBoundingClientRect();
        const labelBounds = subtotalLabel?.getBoundingClientRect();
        const amountBounds = subtotalAmount?.getBoundingClientRect();
        const bounds = ticket?.getBoundingClientRect();
        return {
          viewportWidth: document.documentElement.clientWidth,
          pageWidth: document.documentElement.scrollWidth,
          orderCopyDisplay: orderCopy ? getComputedStyle(orderCopy).display : null,
          summaryStatusGap:
            summaryBounds && statusBounds ? statusBounds.top - summaryBounds.bottom : null,
          subtotalDisplay: subtotal ? getComputedStyle(subtotal).display : null,
          subtotalGap: labelBounds && amountBounds ? amountBounds.left - labelBounds.right : null,
          ticketLeft: bounds?.left ?? null,
          ticketRight: bounds?.right ?? null,
        };
      });

      expect(layout.pageWidth, `page width at ${width}px`).toBeLessThanOrEqual(layout.viewportWidth);
      expect(layout.orderCopyDisplay, `order copy layout at ${width}px`).toBe('grid');
      expect(layout.summaryStatusGap ?? -Infinity, `summary/status gap at ${width}px`).toBeGreaterThanOrEqual(1);
      expect(layout.subtotalDisplay, `subtotal layout at ${width}px`).toBe('grid');
      expect(layout.subtotalGap ?? -Infinity, `subtotal label/value gap at ${width}px`).toBeGreaterThanOrEqual(8);
      expect(layout.ticketLeft ?? -Infinity, `ticket left edge at ${width}px`).toBeGreaterThanOrEqual(-1);
      expect(layout.ticketRight ?? Infinity, `ticket right edge at ${width}px`).toBeLessThanOrEqual(width + 1);
    }
  });

  test('al imprimir muestra solo el ticket y oculta acciones y navegación', async ({ page }) => {
    await page.goto('/__qa/pedido-mesa');
    await expect(page.locator('.alumno-card--ticket')).toBeVisible();
    await page.emulateMedia({ media: 'print' });

    const printStyles = await page.evaluate(() => ({
      ticket: getComputedStyle(document.querySelector('.alumno-card--ticket')!).visibility,
      tracking: getComputedStyle(document.querySelector('.alumno-track-card')!).visibility,
      navigation: getComputedStyle(document.querySelector('.alumno-nav')!).visibility,
      printButton: getComputedStyle(document.querySelector('.alumno-ticket-print')!).display,
    }));

    expect(printStyles).toEqual({
      ticket: 'visible',
      tracking: 'hidden',
      navigation: 'hidden',
      printButton: 'none',
    });
    await expect(page.locator('.alumno-ticket-table')).toBeVisible();
  });
});
