import { Link } from 'react-router-dom';

/**
 * Texto de /pedir que explica qué es pedir y recoger sin filas. Va en el HTML prerenderizado
 * (scripts/prerender.mjs), así que no depende del API ni de la sesión. Mientras la sesión carga
 * es el único encabezado de la página (h1); con la lista ya visible el h1 es «¿Dónde comemos?»
 * y este bloque baja a h2.
 */
export function PedirIntro({ heading = 'h2' }: { heading?: 'h1' | 'h2' }) {
  const Title = heading;
  const Sub = heading === 'h1' ? 'h2' : 'h3';
  return (
    <section className="pedir-intro" aria-labelledby="pedir-intro-title">
      <Title id="pedir-intro-title" className="pedir-intro__title">
        Pide y recoge sin filas en Chihuahua
      </Title>
      <p>
        Con Vaiinilla pides en restaurantes, cafés y cafeterías desde el celular, sin descargar nada: entras a
        vaiinilla.app, eliges el lugar, armas tu pedido y pasas por él cuando está listo. No haces fila para
        ordenar ni para pagar.
      </p>
      <Sub className="pedir-intro__subtitle">Cómo funciona</Sub>
      <ol className="pedir-intro__steps">
        <li>
          <strong>Entra al menú.</strong> Busca el restaurante por nombre, escribe el número de tu mesa o escanea el
          código impreso en ella.
        </li>
        <li>
          <strong>Arma tu pedido.</strong> Elige platillos, personaliza opciones y revisa el total antes de pagar.
        </li>
        <li>
          <strong>Paga como prefieras.</strong> Con tarjeta, con tu saldo o en efectivo, según lo que acepte el lugar.
        </li>
        <li>
          <strong>Recoge cuando esté listo.</strong> Sigue el estado en vivo. En barra te damos un código; en mesa te
          lo llevan.
        </li>
      </ol>
      <p className="pedir-intro__links">
        ¿Tienes dudas con un pedido o un pago? Visita <Link to="/soporte">Soporte</Link>. ¿Quieres saber más o
        tienes un negocio de comida? Conoce <Link to="/">Vaiinilla</Link>.
      </p>
    </section>
  );
}
