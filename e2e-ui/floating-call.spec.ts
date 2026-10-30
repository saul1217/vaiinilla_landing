import { expect, stabilize, test } from './support';

for (const viewport of [{ width: 320, height: 568 }, { width: 360, height: 740 }]) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });
    for (const path of ['/e/demo', '/e/demo/carrito']) {
      test(`${path}: pastilla sin solapamientos`, async ({ prepared: page }) => {
        await page.addInitScript(() => {
          localStorage.setItem('vaiinilla.buyer.space.v1', JSON.stringify({ slug: 'demo', espacioId: 4, nombre: 'Mesa 4', guardadoEn: Date.now() }));
          localStorage.setItem('vaiinilla.buyer.cart.v1', JSON.stringify({ slug: 'demo', establishmentName: 'Demo', guardadoEn: Date.now(), lines: [{ productId: 10, productName: 'Chocolate', quantity: 2, optionIds: [], unitPreview: '40.00', unitCounter: '40.00' }] }));
        });
        await page.route('**/api/v1/**', (route) => {
          const url = new URL(route.request().url());
          const product = { id: 10, categoria_id: 1, nombre: 'Chocolate', descripcion: 'Bebida de cacao', estacion_preparacion: 'caja', precio_mostrador: '40.00', precio_digital: '40.00', disponible: true, imagen_url: null, grupos_opcion: [] };
          const data = url.pathname.endsWith('/catalogo') ? { categorias: [{ id: 1, nombre: 'Bebidas', orden: 1 }], productos: Array.from({ length: 10 }, (_, i) => ({ ...product, id: 10 + i })) }
            : url.pathname.endsWith('/demo') ? { id: '1', nombre: 'Demo', slug: 'demo', identificador_cliente_etiqueta: 'Nombre', identificador_cliente_obligatorio: false }
            : [];
          return route.fulfill({ json: { data, meta: {}, error: null } });
        });
        await page.goto(path);
        await expect(page.locator(path.endsWith('/carrito') ? '.alumno-sticky-pay button' : '.alumno-product').first()).toBeVisible();
        await stabilize(page);
        const fab = page.locator('.alumno-fcw__fab');
        await expect(fab).toBeVisible();
        expect((await fab.boundingBox())!.width).toBeLessThanOrEqual(viewport.width * .4);
        for (const scroll of [0, 300, 10000]) {
          await page.evaluate((y) => window.scrollTo(0, y), scroll);
          if (scroll === 0 && process.env.QA_SHOTS_DIR) await page.screenshot({ path: `${process.env.QA_SHOTS_DIR}/after_${viewport.width}x${viewport.height}${path.replace(/\//g, '_')}_top.png` });
          await expect.poll(() => page.evaluate(() => {
            const pill = document.querySelector('.alumno-fcw__fab')!.getBoundingClientRect();
            return Array.from(document.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [role="button"], nav')).filter(el => {
              if (el.closest('.alumno-fcw')) return false;
              // Solo controles fijos (barra inferior, botón de pagar, cabecera): el contenido que se desplaza pasa por debajo de cualquier botón flotante.
              let fixed = false;
              for (let n: HTMLElement | null = el; n; n = n.parentElement) if (['fixed', 'sticky'].includes(getComputedStyle(n).position)) { fixed = true; break; }
              if (!fixed) return false;
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && r.left < pill.right && r.right > pill.left && r.top < pill.bottom && r.bottom > pill.top;
            }).map(el => `${el.tagName}.${el.className}`);
          })).toEqual([]);
        }
      });
    }
  });
}
