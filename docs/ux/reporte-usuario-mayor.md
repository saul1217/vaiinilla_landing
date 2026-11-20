# Reporte de usabilidad — persona «señor mayor» (~70 años)

**App:** cliente Vaiinilla (`https://www.vaiinilla.app`)  
**Fecha:** 31 oct 2026  
**Evaluador:** prueba simulada (lectura lenta, poca experiencia con apps, no entiende QR/token/cartera/cashback, no descubre gestos de deslizamiento, vista cansada, dedos torpes).

## Metodología

| Aspecto | Detalle |
| --- | --- |
| **Producción** | Playwright headless (Chromium), `https://www.vaiinilla.app`, viewports **390×844** (móvil) y **1280×800** (escritorio). Sin confirmar pedidos ni pagos reales. |
| **Local** | `npm run dev` en rama `main` / código actual; rutas ` /__qa/*` (solo DEV) para carrito lleno, pedidos, mesa compartida y cartera simulada. |
| **Código** | Revisión de rutas (`src/app/router.tsx`) y pantallas no alcanzables en prod (unión a mesa, pago, tema, mesero). |
| **Capturas** | `/opt/cursor/artifacts/ux-mayor/{mobile,desktop}/` (archivos citados abajo). |

## Resumen ejecutivo

La app es visualmente limpia, pero **asume familiaridad con QR, NFC, «cartera» digital y gestos de deslizamiento**. Para una persona mayor que llega por primera vez, el camino más claro es **buscar el negocio (p. ej. Renasci) → «Entrar al menú» → «Abrir menú»**, no el flujo «escanear QR». La jerga técnica aparece **desde la landing**, se repite en **selector de lugar**, **código de mesa**, **cartera/recargas** y **pago (Stripe)**. Varios patrones (**carrusel de pasos**, **chips de categorías**, **barra flotante**, **botón de mesero arrastrable**) no se explican en pantalla.

---

## Hallazgos por flujo

### 1. Primera visita — landing de marketing

| Campo | Detalle |
| --- | --- |
| **Intentó** | Entender qué es Vaiinilla y qué botón pulsar. |
| **Atasco / confusión** | Texto del héroe: *«**Escanea el QR** del lugar, paga desde tu celular y te avisamos cuando tu pedido esté listo.»* |
| **Gravedad** | **Confunde** (en escritorio y móvil). |
| **Sugerencia** | Sustituir QR por lenguaje cotidiano: *«Apunta la cámara al papel de tu mesa»* o *«Pide el número de mesa al mesero»*; botón secundario visible «No tengo código — buscar restaurante». |
| **Captura** | `mobile/01-home.png`, `desktop/01-home.png` |

Bloque «Cómo pedir»: paso 1 *«Escanea o busca tu lugar»* / *«Usa el **QR** de la mesa»*. En móvil solo se ve una tarjeta; **no hay texto «desliza»** (carrusel horizontal).

| **Gravedad** | **Confunde** |
| **Sugerencia** | Flechas grandes «Anterior / Siguiente» o leyenda *«Desliza el dedo hacia la izquierda para ver el paso 2»*. |
| **Captura** | `mobile/01-home.png`, `mobile/01b-como-funciona.png` |

Tarjetas de beneficios en home: *«**Saldo en Cartera**»*, *«Escanea el **QR** de tu mesa»*.

| **Gravedad** | **Confunde** |
| **Sugerencia** | «Dinero guardado en el local» y «Etiqueta de tu mesa». |

---

### 2. Entrar a pedir — `/pedir`

| Campo | Detalle |
| --- | --- |
| **Intentó** | Encontrar su restaurante. |
| **Atasco** | Título *«**¿Dónde comes hoy?**»* — no queda claro si debe buscar nombre, usar mapa o código. |
| **Gravedad** | **Confunde** |
| **Sugerencia** | *«¿En qué restaurante estás?»* + subtítulo fijo: *«Busca el nombre abajo o escribe el número de mesa»*. |
| **Captura** | `mobile/02-pedir.png` |

Sección *«Escanea el QR de tu mesa o de la tienda»* con botones **«Escanear QR»**, **«Escribir código»**, **«Acercar NFC»**.

| **Gravedad** | **Bloquea** (prioriza lo que no entiende) |
| **Sugerencia** | Orden invertido: 1) «Escribir número de mesa (4 números)» grande; 2) «Usar cámara»; NFC en «Más opciones» o solo si el dispositivo lo soporta. |
| **Captura** | `mobile/02-pedir.png` |

Botón **«Usar mi ubicación»** / *«Cerca de mí»*: puede asustar permisos GPS sin explicación.

| **Gravedad** | **Molesta** |
| **Sugerencia** | Texto previo: *«Para ordenar la lista por cercanía (opcional)»*. |

---

### 3. Elegir establecimiento y entrar al menú (prod — Renasci)

| Campo | Detalle |
| --- | --- |
| **Intentó** | Seleccionar Renasci y ver comida. |
| **Atasco** | Tras «Entrar al menú», pantalla intermedia con *«Acceso libre…»* y tarjeta **Mesa**: *«Si ya estás sentado, usa el código del **QR**.»* Botón principal **«Abrir menú»** vs secundario **«Usar código de mesa»** — dos caminos sin jerarquía clara para quien ya eligió el local. |
| **Gravedad** | **Confunde** |
| **Sugerencia** | Si ya eligió negocio en la lista, ir directo al menú; mesa solo si escaneó/código. Texto mesa sin «QR». |
| **Captura** | `mobile/04b-picker-renasci.png` |

Lista: etiquetas *«Recomendado para ti»*, *«Acceso libre»*, flecha ↗ sin texto.

| **Gravedad** | **Molesta** |
| **Sugerencia** | Botón explícito «Elegir este restaurante» en lugar de radio + flecha. |

---

### 4. Menú del establecimiento

| Campo | Detalle |
| --- | --- |
| **Intentó** | Buscar un platillo (p. ej. tacos). |
| **Atasco** | Fila **Todo · Alimentos · Cerveza · Litros** — parece botones sueltos; categorías extra requieren **deslizar horizontal** sin instrucción. |
| **Gravedad** | **Confunde** |
| **Sugerencia** | Sombreado/flecha en el borde derecho + texto *«Hay más categorías →»*. |
| **Captura** | `mobile/04c-menu-real.png` |

Banner verde **«Rentar una cancha»** en un menú de comida.

| **Gravedad** | **Confunde** |
| **Sugerencia** | Separar reservas en pestaña propia o titular *«¿Quieres apartar cancha? (opcional)»*. |

Iconos arriba a la derecha (bolsa, perfil **«A»**) **sin texto**.

| **Gravedad** | **Confunde** |
| **Sugerencia** | Etiquetas «Carrito» y «Mi cuenta» bajo el icono o menú «Más». |

Barra inferior **flotante** tapa parte del menú al hacer scroll.

| **Gravedad** | **Molesta** |
| **Sugerencia** | Anclar barra al borde inferior; aumentar margen inferior del listado. |

Pestaña **«Cartera»** en navegación.

| **Gravedad** | **Confunde** |
| **Sugerencia** | Renombrar a **«Mi saldo»**. |
| **Captura** | `mobile/04c-menu-real.png` |

---

### 5. Ver producto y agregar al carrito

| Campo | Detalle |
| --- | --- |
| **Intentó** | Ver qué lleva el platillo y agregarlo. |
| **Atasco** | Hoja inferior: cierre **X** pequeño; franja superior gris (agarre) no explicada — puede no saber cómo cerrar. Texto *«Tu selección: Sin opciones adiciona…»* truncado. |
| **Gravedad** | **Confunde** |
| **Sugerencia** | Botón ancho «Cerrar»; «Sin extras» en lugar de «opciones adicionales»; campos «Instrucciones (opcional)» con ejemplo grande. |
| **Captura** | `mobile/05-producto-real.png` |

Botones **− / +** pequeños en verde claro.

| **Gravedad** | **Molesta** (dedos torpes) |
| **Sugerencia** | Controles mín. 48×48 px y contraste más alto. |

---

### 6. Carrito, nota y pagar (local QA + código)

| Campo | Detalle |
| --- | --- |
| **Intentó** | Revisar pedido, dejar nota a cocina y pagar. |
| **Atasco** | Etiqueta **«Nota para cocina»** está bien; enlace **«Quitar»** pequeño y poco contrastado junto a **−/+**. Destino **«Para llevar»** vs mesa no probado en prod sin mesa. |
| **Gravedad** | **Molesta** |
| **Sugerencia** | Botón «Eliminar platillo» en lugar de enlace; icono de cubiertos/mesa para destino. |
| **Captura** | `mobile/qa-carrito-lleno.png` |

Al pulsar **«Pagar»**, hoja **«¿Cómo quieres pagar?»** (revisado en código `cart-page.tsx`): opciones **«Pagar al final»** (badge «Cuenta»), **«Pago en caja»**, **«Saldo Vaiinilla»**, **«Pago con Stripe»** (badge **«Stripe»**).

| **Gravedad** | **Bloquea** / **Confunde** |
| **Sugerencia** | «Tarjeta débito/crédito» sin marca Stripe; «Dejar todo anotado y pagar al salir» con subtítulo largo; evitar «cashback» en copy visible. |

En QA la hoja no abre (`onPay` vacío en `AlumnoQaFilledCartPage`); validación por copy en código.

---

### 7. Pedidos — `/cuenta/pedidos` (sin sesión)

| Campo | Detalle |
| --- | --- |
| **Intentó** | Ver si ya hay comida pedida. |
| **Atasco** | *«Aún no hay pedidos en **esta sesión**.»* — «sesión» es término técnico. Texto *«**saldo** e **historial**»* en pie. |
| **Gravedad** | **Confunde** |
| **Sugerencia** | *«Aún no has pedido nada hoy»*; *«Crear cuenta (opcional) para guardar pedidos anteriores»*. |
| **Captura** | `mobile/10-pedidos.png` |

---

### 8. Cuenta / acceso — `/cuenta`

| Campo | Detalle |
| --- | --- |
| **Intentó** | Entrar para ver pedidos o saldo. |
| **Atasco** | Pantalla *«Tu lugar, a tu ritmo»* con botón dominante **«Continuar con Google»**; **«Comprar sin cuenta»** es secundario. Enlace pequeño «Crear cuenta con correo». |
| **Gravedad** | **Confunde** (quien no usa Google) |
| **Sugerencia** | Primero **«Pedir sin registrarme»**; Google y correo como alternativas. |
| **Captura** | `mobile/08-cuenta.png` |

Pestaña **Pedidos** sin cuenta redirige a flujo de acceso (prod).

| **Gravedad** | **Confunde** |
| **Sugerencia** | En Pedidos vacío, explicar enlace mágico por SMS/correo solo si pidió como invitado. |

---

### 9. Cartera / saldo (local QA + copy)

| Campo | Detalle |
| --- | --- |
| **Intentó** | Saber cuánto dinero tiene para pagar. |
| **Atasco** | Título **«Cartera»**; tarjeta **Recargar** → *«**Mostrar QR**»*; saldo *«Saldo Vaiinilla»*. |
| **Gravedad** | **Confunde** |
| **Sugerencia** | Pantalla **«Mi saldo en [nombre del local]»**; recarga: *«Muestra esta pantalla en caja»* con imagen grande, sin decir QR. |
| **Captura** | `mobile/qa-cartera.png` |

En cuenta registrada (código): sección **«QR para recargar»** y URL técnica bajo el código.

| **Gravedad** | **Confunde** |
| **Sugerencia** | Mismo criterio; ocultar URL. |

---

### 10. Código de mesa (hoja inferior — código)

| Campo | Detalle |
| --- | --- |
| **Intentó** | Escribir el número de la mesa. |
| **Atasco** | Título útil: *«Ingresa el código de mesa»*; pero el cuerpo dice *«…junto al **QR** de tu mesa»*. |
| **Gravedad** | **Confunde** |
| **Sugerencia** | *«Escribe los 4 números que ves en la mesa o en el papel del mesero»*. |

---

### 11. Mesa compartida y «pagar al final» (local QA — no probado en prod)

| Campo | Detalle |
| --- | --- |
| **Intentó** | Entender qué pidió él y cuánto debe pagar con otros comensales. |
| **Atasco** | Bloque **«CUENTA DE LA MESA»** con subtotales por persona, *«Tu parte por pagar»*, montos largos; mezcla pedidos #96–#98. Enlace flotante de accesibilidad **«Saltar al contenido»** superpuesto al texto. |
| **Gravedad** | **Bloquea** |
| **Sugerencia** | Vista simple por defecto: *«Tú pediste: $X»* / *«Total mesa: $Y (lo paga quien corresponda)»*; detalle expandible «Ver desglose». |
| **Captura** | `mobile/qa-pedido-mesa.png` |

Flujo **«¿Quién eres?»** / *«¿Continuar como [nombre]?»* al unirse por enlace de mesa (`table-who-page.tsx`) — no ejecutado en prod (requiere token real).

| **Gravedad** | **Confunde** |
| **Sugerencia** | *«¿Cómo te llaman en la mesa?»* con ejemplos «Don José», «Mesa familiar». |

---

### 12. Llamar al mesero (código + FAB)

| Campo | Detalle |
| --- | --- |
| **Intentó** | Pedir ayuda o la cuenta. |
| **Atasco** | Botón flotante **arrastrable** (`aria-label`: *«Llamar al mesero»*) sin texto visible; fácil moverlo sin querer; no aparece sin mesa escaneada. |
| **Gravedad** | **Confunde** |
| **Sugerencia** | Barra fija «¿Necesitas al mesero?» + lista de motivos en palabras simples («Traer cuenta», «Cubiertos», «Otro»). |
| **Captura** | `mobile/qa-pedido-mesa.png` (FAB no visible sin `localStorage` de mesa en prod) |

---

### 13. Seguimiento de pedido (código / invitado)

| Campo | Detalle |
| --- | --- |
| **Intentó** | Saber si la comida está lista. |
| **Atasco** | Rutas `/seguimiento/:token` y enlaces «seguimiento» usan **token** opaco; panel pickup muestra **«Código QR del pedido»** (`order-pickup-panel.tsx`). |
| **Gravedad** | **Confunde** |
| **Sugerencia** | Mostrar **número de pedido grande (#93)** y frase *«Muéstrale esto en la barra»*; evitar «QR» en el titular. |

Estados **PREPARANDO**, **PAGO CONFIRMADO**, etc. en mayúsculas (captura QA).

| **Gravedad** | **Molesta** |
| **Sugerencia** | Frases completas: *«Estamos preparando tu comida»*. |

---

### 14. Tema visual — `/cuenta` (cuenta iniciada; revisión código)

| Campo | Detalle |
| --- | --- |
| **Intentó** | Poner letras más grandes o fondo claro. |
| **Atasco** | Opciones **Sistema · Claro · Oscuro · AMOLED** — «AMOLED» y «Sistema» no son obvios. |
| **Gravedad** | **Confunde** |
| **Sugerencia** | Solo **«Letras claras (fondo blanco)»** / **«Letras claras (fondo negro)»**; ocultar AMOLED salvo avanzado. |

---

### 15. Soporte — `/soporte`

| Campo | Detalle |
| --- | --- |
| **Intentó** | Pedir ayuda humana. |
| **Atasco** | Pantalla clara con correo `equipo@vaiinilla.app` (positivo). |
| **Gravedad** | — |
| **Sugerencia** | Añadir botón «Llamar» si hay teléfono del local (secundario). |
| **Captura** | `mobile/11-soporte.png` |

---

## Top 10 mejoras (por impacto)

1. **Reemplazar «QR» en toda la experiencia** (landing, `/pedir`, código de mesa, recargas, pickup) por instrucciones en lenguaje hablado y un camino principal «Escribir número de mesa».
2. **Renombrar «Cartera» → «Mi saldo»** (nav, títulos, home features) y eliminar «Mostrar QR» en recargas.
3. **Reordenar entrada al local:** número de mesa y buscar restaurante antes que «Escanear QR» / NFC.
4. **Etiquetas de pago sin jerga:** quitar «Stripe», explicar «Pagar al final» como en restaurante tradicional, «Tarjeta» en lugar de pasarela.
5. **Affordances de deslizamiento:** carrusel «Cómo pedir» y categorías del menú con texto o flechas visibles.
6. **Acceso / cuenta:** priorizar **«Pedir sin registrarme»** sobre Google; evitar «sesión», «token», «historial» en pantallas vacías.
7. **Cuenta de mesa compartida:** vista resumida por defecto (solo «lo tuyo» + total mesa); desglose opcional.
8. **Mesero:** control fijo con texto, no solo FAB arrastrable; visible cuando hay mesa activa.
9. **Tamaño y contraste táctil:** botones −/+, enlaces «Quitar», chips de tema; iconos superiores con texto.
10. **Reducir ruido:** banner de canchas en menú de comida; opción AMOLED; URLs técnicas bajo códigos de recarga.

---

## Inventario de capturas

| Archivo | Contenido |
| --- | --- |
| `mobile/01-home.png` | Landing móvil |
| `mobile/01b-como-funciona.png` | Carrusel «Cómo pedir» (solo paso 1 visible) |
| `mobile/02-pedir.png` | Selector de lugar |
| `mobile/04b-picker-renasci.png` | Paso intermedio Renasci |
| `mobile/04c-menu-real.png` | Menú Renasci (prod) |
| `mobile/05-producto-real.png` | Ficha de producto |
| `mobile/08-cuenta.png` | Acceso sin sesión |
| `mobile/10-pedidos.png` | Pedidos vacíos |
| `mobile/11-soporte.png` | Soporte |
| `mobile/qa-carrito-lleno.png` | Carrito con total |
| `mobile/qa-cartera.png` | Pantalla Cartera (QA) |
| `mobile/qa-pedido-mesa.png` | Pedido en mesa + cuenta compartida |
| `mobile/qa-pedidos.png` | Lista de pedidos QA |
| `desktop/*.png` | Equivalentes escritorio (landing, pedir, cuenta, soporte) |

---

## Limitaciones de esta prueba

- No se completó checkout real ni pago con tarjeta en producción (por diseño).
- La hoja «¿Cómo quieres pagar?» no se abrió en `/__qa/carrito-lleno` (handler de demo); copy validado en `src/pages/cart-page.tsx`.
- Unión a mesa con QR/token real, llamada al mesero con backend y flujo Stripe completo dependen de establecimiento y mesa activos; complementado con rutas QA y lectura de código.
