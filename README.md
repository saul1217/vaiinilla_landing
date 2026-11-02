# Vaiinilla (vaiinilla.app)

Sitio público de Vaiinilla: marketing, soporte y experiencia de **comprador** en una sola app **Vite + React**.

El panel de establecimiento (admin, POS, cocina, plataforma) vive en [`vaiinilla-web`](https://github.com/saul1217/vaiinilla-web) / `app.vaiinilla.app`. No se mezcla aquí.

## Desarrollo

```bash
npm install
cp .env.example .env.local   # opcional; el menú público funciona sin Firebase
npm run dev
```

Sin `VITE_FIREBASE_*` puedes descubrir establecimientos y ver el menú. El alta, checkout, tracking y wallet necesitan Firebase + API.

## Validación

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

## Rutas

| Ruta | Superficie |
| --- | --- |
| `/`, `/soporte` | Marketing y ayuda |
| `/pedir`, `/e/:slug`, `/e/:slug/carrito` | Discovery, menú, carrito |
| `/cuenta`, `/cuenta/pedidos`, `/cuenta/saldo` | Alumno |
| `/u/:id` | QR de recarga en Caja |

`app.vaiinilla.app` queda para staff.

## Monitoreo (Sentry)

Opcional. En Vercel define `VITE_SENTRY_DSN` (DSN del proyecto `vaiinilla-landing-production` en Production y `vaiinilla-landing-develop` en el build de develop) y `VITE_APP_ENV` (`production` / `development`). Sin `VITE_SENTRY_DSN` no se inicializa. No envía PII (el SDK de navegador no adjunta IP/cookies por defecto; `tracesSampleRate: 0`).
