# Reservas de boliche del cliente (web)

Paridad con la app Android (`ReservationsScreen` / `ReservationsViewModel`, reglas R11, R25 y U03).
Usa las rutas que ya existen en `vaiinilla_back` (develop), sin cambios en el backend:
`GET /reservas/disponibilidad`, `POST /reservas`, `POST /reservas/:id/pago`,
`POST /reservas/:id/cancelacion` y `GET /reservas`. Contrato: `docs/reservas-cancha.md`,
sección «Boliche: pistas».

## Bandera

`VITE_FEATURE_RESERVAS_BOLICHE=true` la prende (Vercel o `.env.local`). Apagada por defecto:
la renta se ve y funciona igual que antes (todo dice «cancha» y no se piden jugadores).

## Qué cambia con la bandera prendida y un negocio `tipo_establecimiento: 'boliche'`

- Todo dice «pista» / «pistas» (encabezado, entrada del menú, selector, botón, hoja de pago).
- Antes de apartar se pide cuántos juegan, de 1 a la `capacidad` de la pista (30 si no tiene).
  Va como `jugadores` en `POST /reservas` (el backend lo exige: `422 PLAYERS_REQUIRED`).
- Cada pista ofrece sus `duraciones_min` (las que respetan su mínimo); sin ellas, las del día.
- Un día con `cerrado: true` muestra «Este día no se rentan pistas».
- La hoja de pago y «Mis reservas» muestran los jugadores.
- El pago es el mismo de las canchas: efectivo en caja o tarjeta con Stripe (la clave pública
  `pk_test_` en development; `src/lib/stripe-public.ts` rechaza `pk_live_` fuera de producción).

## Código

Módulo propio en `src/boliche/` (`flag.ts`, `bowling.ts`, `players-stepper.tsx`, `bowling.css` y
sus pruebas). La pantalla de canchas (`src/pages/reservations-page.tsx`) y su estado
(`src/lib/use-reservations.ts`) solo leen `day.bowling`, que el parser pone en `true` cuando la
bandera está prendida y el negocio es boliche.

## Fuera de este cambio

- Cambiar la duración o los jugadores de una reserva ya apartada (Android lo hace desde la hoja
  de pago); la web tampoco lo tiene para canchas.
- Dibujar las pistas como pista de bolos (Android `drawsLanes`); aquí se usa la misma tarjeta.
