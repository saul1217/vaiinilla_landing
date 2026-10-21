# QA de interfaz y accesibilidad (QA-048)

Capturas comparadas, axe, pruebas de teclado y Lighthouse CI para `/pedir`, menú de tienda, canchas, «Mis pedidos» y «Mis reservas».

## Cómo corre

- Contra el preview de Vercel del mismo commit y la API de develop: `E2E_BASE_URL=<preview> npm run test:ui`.
- Datos del establecimiento de CI sembrados con `/dev/test-setup` (horarios, productos y fotos fijos, sin edición manual). Slugs por defecto `ci-tienda` y `ci-canchas`; se cambian con `E2E_UI_SHOP_SLUG` y `E2E_UI_COURTS_SLUG`. «Mis pedidos» y «Mis reservas» usan `E2E_CLIENTE_EMAIL` y `E2E_PASSWORD`.
- Lighthouse CI: `npm run lhci` con `lighthouserc.json` (umbrales de performance, accesibilidad y buenas prácticas en `/pedir`, canchas y menú). Se ejecuta con el preview como `--collect.url` absoluto.

## Estabilidad

- Reloj fijo con `page.clock` (`2026-10-20T15:00:00Z`), zona `America/Mexico_City`.
- Animaciones y transiciones desactivadas; horas, contadores y folios ocultos (`VOLATILE_SELECTORS` en `e2e-ui/support.ts`; para ocultar otro elemento basta `data-volatile`).
- Cada captura espera a que terminen las fuentes, la red y a que aparezca el contenido sembrado.
- Tamaños 390x844 y 1280x800, tema claro y oscuro.

## Corridas bloqueadas (datos de develop)

Si la API responde 5xx, falla la red hacia `/api/v1/` o no aparece el contenido sembrado, la prueba se **omite** con anotación `bloqueada` (`BLOQUEADA por datos/API de develop`). No cuenta como regresión y, al omitirse antes de comparar, no escribe ni modifica capturas. Las referencias no se actualizan en una corrida bloqueada.

## Referencias de capturas

Solo se generan en el contenedor fijo de Playwright en CI (`mcr.microsoft.com/playwright:v<versión de @playwright/test>-noble`) con `PLAYWRIGHT_CONTAINER=1 npx playwright test -c playwright.ui.config.ts visual --update-snapshots`. `playwright.ui.config.ts` rechaza `--update-snapshots` fuera de ese contenedor. Las referencias quedan en `e2e-ui/__screenshots__/`.

## axe

Bloquea solo violaciones `serious` y `critical` (WCAG 2/2.1 A y AA, 390 px, ambos temas). Excepciones en `e2e-ui/a11y-exceptions.json`; cada una exige `ticket` con formato `owner/repo#N`.

## Teclado y estados

Escape cierra la hoja de producto y devuelve el foco; objetivos táctiles de 44 px; sin desbordamiento horizontal a 390 px; estados de error, vacío y carga sin pantalla en blanco.

## Workflow de CI

La integración de GitHub Actions no se pudo subir desde esta automatización (no puede modificar `.github/workflows`). Ejemplo en `docs/qa-interfaz.workflow.yml.example`.
