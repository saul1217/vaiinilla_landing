# Evidencia del PR #160 (tema AMOLED) y de los 16 fallos de `ui`

## Los 16 fallos ya estaban en develop

Las mismas 16 pruebas fallan, con el mismo nombre y el mismo error, en develop y en la rama del PR #160:

| Corrida de qa-interfaz | Commit | Resultado |
| --- | --- | --- |
| 42309922140 (develop, 6 nov) | `a4b3efd` | 16 failed, 12 skipped, 17 passed |
| 42663533511 (develop, 9 nov 17:19) | `c9343ec` | 16 failed, 12 skipped, 17 passed |
| 42675984373 (PR #160) | `1bd4104` | 16 failed, 12 skipped, 17 passed |

`diff` de la lista de pruebas fallidas entre 42663533511 y 42675984373: sin diferencias.

- 12 son `visual.spec.ts:9` (`pedir`, `menu-tienda`, `canchas` en claro/oscuro, 390x844 y 1280x800) con
  `A snapshot doesn't exist at .../e2e-ui/__screenshots__/...`: el repo nunca tuvo capturas de referencia.
- 4 son `canchas con día seleccionado y apartado`: `locator.click` agota 30 s porque la tienda de CI no tiene
  horarios libres. Este PR trae el arreglo del #141: sin horario libre la prueba queda bloqueada, como las
  demás que dependen de datos de develop, en vez de agotar el tiempo.

## Diferencias visuales esperadas (móvil 390x844)

`capturas-temas.mjs` toma `/pedir` y el menú de `ci-vaiinilla` con la API simulada en el navegador (nada sale a
development ni a producción) y Roboto de Google Fonts. `develop/` es `origin/develop` (`c9343ec`); `pr/` es
esta rama. `comparar.mjs` cuenta los píxeles distintos:

| Pantalla | Tema | develop | PR | Píxeles distintos |
| --- | --- | --- | --- | --- |
| pedir | claro | 390x1497 | 390x1476 | 15.8 % |
| pedir | oscuro | 390x1497 | 390x1476 | 14.0 % |
| pedir | AMOLED (contra oscuro de develop) | 390x1497 | 390x1476 | 93.9 % |
| menu-tienda | claro | 410x1019 | 410x997 | 18.6 % |
| menu-tienda | oscuro | 410x1019 | 410x997 | 22.6 % |
| menu-tienda | AMOLED (contra oscuro de develop) | 410x1019 | 410x997 | 64.7 % |

Lo que cambia, y es lo que pide el #160:
- Letra: develop usa `-apple-system, ..., Roboto`; el PR usa `Roboto` (Type.kt de Android). Roboto mide distinto,
  por eso las páginas quedan unos 21 px más bajas y el texto se reacomoda.
- Barra inferior oscura de Android (`VaiinillaBottomNav`) y chips/tarjetas de los componentes base.
- AMOLED: `data-vai-theme="amoled"`, fondo `rgb(0, 0, 0)` y `theme-color` `#000000`. Claro: `#F4F1E7`.
  Oscuro: `#171817`. develop no tiene modo AMOLED.

El ancho de 410 px del menú a 390 px viene de develop (igual en las dos ramas); no lo cambia este PR.

## Referencias de `e2e-ui/__screenshots__`

Solo se pueden generar en el contenedor `mcr.microsoft.com/playwright:v1.63.0-noble` contra el preview de
Vercel y la API de develop (`docs/qa-interfaz.md`). Con este PR, lanzar `qa-interfaz` por `workflow_dispatch`
con `update_snapshots=true` y el `base_url` del preview sube el artefacto `capturas-referencia`; esas capturas se
revisan contra las de esta carpeta antes de versionarlas.
