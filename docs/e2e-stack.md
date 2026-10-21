# E2E con Playwright contra el stack de CI (QA-046)

Tres pruebas de punta a punta, solo Chromium, contra el stack local de CI de QA-044
(backend + emulador de Firebase Auth). **No** apuntan a develop ni a un Firebase real.

| Prueba | Qué protege |
| --- | --- |
| Registro con correo | QA-042: el correo de verificación sale antes del alta; el alta solo se acepta con el correo ya verificado. El enlace se lee de `GET {emulador}/emulator/v1/projects/{proyecto}/oobCodes` (sin buzón de paga). |
| Pedido en mesa | Invitado entra por el QR de la mesa, pide y paga en caja. |
| «Mis pedidos» del invitado | QA-033: si el pedido ya no existe (404), «Tu pedido #N» se borra y `?nuevo=` avisa «Este pedido ya no está disponible.». |

## Correr en local

Con el stack de QA-044 arriba:

```
E2E_API_ORIGIN=http://127.0.0.1:3000 \
E2E_AUTH_EMULATOR_URL=http://127.0.0.1:9099 \
E2E_FIREBASE_PROJECT_ID=demo-vaiinilla \
E2E_PLACE_SLUG=<slug sembrado> \
E2E_TABLE_QR_TOKEN=<token QR de una mesa sembrada> \
E2E_PRODUCT_NAME=<producto disponible> \
npm run test:e2e:stack
```

`playwright.stack.config.ts` levanta Vite con `VITE_FIREBASE_AUTH_EMULATOR_URL` (la app se conecta al
emulador con `connectAuthEmulator`) y `E2E_API_ORIGIN` (el proxy `/api` de Vite apunta al backend del
stack). Sin esas variables la app se comporta igual que antes. `npm run test:e2e` (las pruebas contra
development) ignora `e2e/stack/`.

## Correr en CI solo si cambia `src/` o las migraciones

El agente no puede modificar `.github/workflows`, así que el workflow queda aquí para copiarlo.
Ajusta el paso que levanta el stack al de QA-044 y la ruta de las migraciones.

```yaml
name: E2E stack
on:
  pull_request:
    branches: [develop]
    paths: ['src/**', 'migrations/**', 'e2e/stack/**', 'playwright.stack.config.ts']
  push:
    branches: [develop]
    paths: ['src/**', 'migrations/**', 'e2e/stack/**', 'playwright.stack.config.ts']
jobs:
  e2e-stack:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      # - run: <levantar el stack de QA-044: backend, migraciones/seed y emulador de Auth>
      - run: npm run test:e2e:stack
        env:
          E2E_PLACE_SLUG: ${{ vars.E2E_PLACE_SLUG }}
          E2E_TABLE_QR_TOKEN: ${{ vars.E2E_TABLE_QR_TOKEN }}
          E2E_PRODUCT_NAME: ${{ vars.E2E_PRODUCT_NAME }}
```
