# Novedades del 16 nov 2026 (equipo «ultra y David»)

Esta nota es para los agentes y las personas que trabajan en este repo. El 16 nov el equipo «ultra y David» (Kao) juntó el PR #194 a `develop` (`3ff01d6`), con merge y sin reescribir historial. Reúne los PR #190 a #193, que se cerraron sin juntar. Si encuentras pantallas, archivos o estilos nuevos, salen de aquí. No son un error.

## Qué trae #194

1. **Modo papás completo**, detrás de `VITE_FEATURE_MODO_PAPAS`: agregar un hijo con el código de la escuela, recargar, apartar la comida de la semana, controles (límite, alergias, bloqueos, PIN y credencial), invitar a otro tutor, solicitudes a la escuela y el aviso de privacidad de tutelas.
2. **Lado del alumno**, con la misma bandera: en Mi saldo, el alumno conecta su cuenta con su tutor y ve sus controles.
3. **«¿Qué pasó?» en domicilio**, detrás de la bandera de domicilio: el cliente escribe al negocio por WhatsApp mientras el pedido todavía puede cambiar.
4. **Mis pedidos trae todas las páginas**, sin bandera: quita los repetidos y ordena del más nuevo al más viejo, como Expo. Antes, una cuenta con más de 30 pedidos no veía el pedido de hoy.
5. **Vercel solo despliega `main` y `develop`.**

Al juntar solo chocó `src/styles/alumno.css`, donde se dejaron los dos bloques.

## Lo que falta

- Que Saúl prenda en Vercel las banderas del modo papás, la cartera y el asistente.
- Que el aviso de tutelas deje de ser borrador en dev. Mientras sea borrador, agregar o vincular hijos no funciona y no se ha probado.
- Recorrer el modo papás antes de llevarlo a `main`.

## Abierto, sin juntar

- #189: imágenes en WebP del tamaño real, lazy en miniaturas y caché largo (de ultra).

## Si algo falla

Puedes revertir lo que haga falta. Si lo haces, deja la aclaración en el commit del revert o en el PR: qué falló, cómo lo viste y qué PR revertiste. Así podemos arreglarlo y volver a meterlo. Si tienes dudas, avisa a Kao (`winkakao3-dev`) o comenta en el PR que corresponde.
