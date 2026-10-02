# Agregar Vaiinilla a la pantalla de inicio (iPhone)

Safari no deja que una página oculte sus barras. Para usar la web de compra a
pantalla completa, sin barras de Safari, hay que agregarla a la pantalla de inicio.

## Pasos para el cliente

1. Abre el negocio en Safari, por ejemplo `vaiinilla.app/e/padel`.
2. Toca el botón **Compartir** (el cuadro con la flecha hacia arriba).
3. Baja y toca **Agregar a pantalla de inicio**.
4. Deja el nombre "Vaiinilla" y toca **Agregar**.
5. Abre Vaiinilla desde el ícono nuevo. Se abre a pantalla completa, sin barras de Safari,
   en la misma página donde la agregaste.

## Cómo está configurado

- `public/manifest.webmanifest`: `display: standalone`, colores e íconos.
- `index.html`: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`
  (`black-translucent`), `apple-touch-icon` y `viewport-fit=cover`.
- La barra inferior, los botones fijos y las hojas suman `env(safe-area-inset-bottom)`,
  para no quedar bajo la barra de inicio del iPhone ni bajo las barras de Safari.

## Límites

- En Safari normal las barras siguen visibles: es una regla de iOS.
- La sesión de la app de pantalla de inicio es aparte de la de Safari: el cliente puede
  tener que iniciar sesión otra vez la primera vez.
