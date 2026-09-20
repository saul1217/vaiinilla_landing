import { STAFF_APP_URL } from '../types/api';
import { PageShell } from '../components/shell';

export function SupportPage() {
  return (
    <PageShell>
      <main id="main-content" className="support">
        <section className="container support__inner">
          <p className="eyebrow">Soporte</p>
          <h1>
            ¿Necesitas <span className="highlight">ayuda</span>?
          </h1>
          <p className="support__lead">
            Estamos para ayudarte con tu pedido, tu saldo, un pago o tu cuenta. Escríbenos y te
            respondemos lo antes posible.
          </p>

          <div className="support__card">
            <h2>Contacto directo</h2>
            <p>
              La vía más rápida es el correo. Incluye el correo con el que entras y, si tu duda es
              de un pedido, el número o folio que aparece en tu ticket.
            </p>
            <a className="btn btn--primary" href="mailto:equipo@vaiinilla.app">
              equipo@vaiinilla.app
            </a>
          </div>

          <div className="support__grid">
            <article className="support__card">
              <h3>Pedidos y saldo</h3>
              <p>
                Si tu pedido no aparece, tardó más de lo indicado o tu saldo no se refleja después
                de una recarga, escríbenos con la hora aproximada y el establecimiento donde lo hiciste.
              </p>
            </article>
            <article className="support__card">
              <h3>Pagos</h3>
              <p>
                Los pagos con tarjeta los procesa Stripe de forma segura. Si un cargo se ve
                duplicado o no se completó, mándanos el correo de tu cuenta y la fecha del intento.
              </p>
            </article>
            <article className="support__card">
              <h3>Tu cuenta</h3>
              <p>
                Para eliminar tu cuenta puedes hacerlo desde la app en Configuración, o seguir la
                guía en{' '}
                <a href={`${STAFF_APP_URL}/eliminar-cuenta`}>app.vaiinilla.app/eliminar-cuenta</a>.
                Los documentos legales vigentes están en{' '}
                <a href={`${STAFF_APP_URL}/legal/terminos/2026-07`}>Términos</a> y{' '}
                <a href={`${STAFF_APP_URL}/legal/privacidad/2026-07`}>Privacidad</a>.
              </p>
            </article>
          </div>

          <p className="support__foot">
            Vaiinilla conecta a quienes comen con quienes sirven en cualquier negocio de comida.
            Gracias por tu paciencia mientras crecemos.
          </p>
        </section>
      </main>
    </PageShell>
  );
}
