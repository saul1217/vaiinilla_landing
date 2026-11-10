# Asistente de pedidos del cliente (web)

Paridad con Android (`ui/assistant/CustomerAssistantScreen.kt`). Usa la ruta que ya existe en el
backend, `POST /api/v1/asistente-cliente` (vaiinilla_back `src/routes/asistente-cliente.routes.js`).
No hay cambios en el backend ni migraciones.

## Bandera

Apagada por defecto. Se prende por ambiente con:

```
VITE_FEATURE_ASISTENTE_CLIENTE=true
```

Módulo: `src/lib/customer-assistant-flag.ts`. Apagada, la ruta `/e/<negocio>/asistente` no se
registra y el menú no enseña «Pregúntame qué pedir». Prendida, la entrada sale solo si la tienda
tiene el asistente para clientes (`asistente_clientes` de `GET /publico/establecimientos/:slug`;
ausente cuenta como sí, igual que Android).

## Qué hace

- Plática con el asistente (hasta 40 mensajes de 600 letras), sugerencias iniciales y opciones
  que manda el servidor, «Empezar de nuevo» y aviso cuando ya no quedan mensajes.
- Tarjetas de productos: «Agregar» (sin opciones obligatorias) o «Elegir», que abre la ficha del
  producto en el menú. Nunca escoge opciones por el cliente.
- Pedido propuesto: «Agregar al carrito» reemplaza lo que puso el pedido anterior del asistente sin
  tocar lo que el cliente agregó a mano; nombra lo que no entró. Se manda desde el carrito con el
  pago de siempre (el asistente no crea pedidos ni cobra; no toca Stripe).
- «Llamar al mesero» con el motivo sugerido, solo con mesa escaneada (`POST /espacios/:id/llamadas`).
- Pistas o canchas con su disponibilidad; «Rentar» lleva a `/e/<negocio>/canchas`.
- Sin cuenta: pide el nombre del invitado antes de la primera respuesta (alta de invitado normal).
  Donde se pide con matrícula, pide entrar a la cuenta.
- Errores: `ASSISTANT_DISABLED` cierra la plática; `ASSISTANT_UNAVAILABLE`, `CONTEXT_MISMATCH` y
  demás se dicen tal cual y dejan reintentar.
