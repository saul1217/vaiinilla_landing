import { Link } from 'react-router-dom';
import { STAFF_APP_URL } from '../types/api';
import { PageShell, useReveal } from '../components/shell';

export function HomePage() {
  useReveal();

  return (
    <PageShell marketing>
      <main id="main-content">
        <section className="hero" id="top">
          <div className="hero__grid container">
            <div className="hero__copy">
              <div className="hero__brand" data-reveal>
                <img
                  src="/brand/vaiinilla-logo-splash-light.png"
                  alt="Vaiinilla"
                  width="1448"
                  height="1086"
                  fetchPriority="high"
                />
              </div>
              <p className="eyebrow" data-reveal>
                La nueva forma de vivir tu cafetería
              </p>
              <h1 data-reveal>
                Más recreo.
                <br />
                <span className="highlight">Menos fila.</span>
              </h1>
              <p className="hero__lead" data-reveal>
                Vaiinilla junta el menú, tu pedido y la operación de la cafetería en un solo lugar.
              </p>
              <div className="hero__actions" data-reveal>
                <Link className="btn btn--primary" to="/pedir">
                  Pedir ahora
                </Link>
                <a className="text-link" href="#como-funciona">
                  Conoce el recorrido <span aria-hidden="true">↓</span>
                </a>
              </div>
              <p className="hero__note" data-reveal>
                <span className="status-dot" aria-hidden="true" /> Menú disponible desde la web y tu celular
              </p>
            </div>

            <div className="hero__visual" data-reveal>
              <div className="hero__panel">
                <div className="hero__panel-top">
                  <span>MENÚ DEL DÍA</span>
                  <span>01 / 09</span>
                </div>
                <div className="hero__device device device--hero">
                  <div className="device__screen">
                    <img
                      src="/screens/screen-1.jpeg"
                      alt="Menú de Vaiinilla con categorías y productos disponibles"
                      width="738"
                      height="1600"
                      fetchPriority="high"
                    />
                  </div>
                </div>
                <p className="hero__caption">
                  Lo que se antoja,
                  <br />
                  <strong>a la mano.</strong>
                </p>
              </div>
              <div className="hero__ticket hero__ticket--one">
                <span aria-hidden="true">↘</span>
                <strong>Ordena</strong>
                <small>sin crear cuenta</small>
              </div>
              <div className="hero__ticket hero__ticket--two">
                <span className="status-dot" aria-hidden="true" />
                <strong>Listo para recoger</strong>
              </div>
            </div>
          </div>
          <div className="hero__rule" aria-hidden="true" />
        </section>

        <section className="story" id="como-funciona">
          <div className="container">
            <div className="section-intro" data-reveal>
              <p className="eyebrow">De la idea al pedido</p>
              <h2>
                Un recorrido corto.
                <br />
                <span className="lime-text">Una experiencia completa.</span>
              </h2>
              <p>La web acompaña cada momento: descubrir, elegir, confirmar y recoger.</p>
            </div>
            <div className="story__grid">
              <article className="story-card story-card--dark" data-reveal>
                <div className="story-card__meta">
                  <span>01</span>
                  <span>DESCUBRE</span>
                </div>
                <div className="story-card__copy">
                  <h3>Encuentra tu cafetería.</h3>
                  <p>Explora como invitado. El menú empieza donde estás.</p>
                </div>
                <div className="story-card__phone device">
                  <div className="device__screen">
                    <img
                      src="/screens/screen-8.jpeg"
                      alt="Pantalla de Vaiinilla para encontrar una cafetería y explorar su menú"
                      width="738"
                      height="1600"
                      loading="lazy"
                    />
                  </div>
                </div>
              </article>
              <article className="story-card story-card--lime" data-reveal>
                <div className="story-card__meta">
                  <span>02</span>
                  <span>ELIGE</span>
                </div>
                <div className="story-card__copy">
                  <h3>Arma lo que se te antoja.</h3>
                  <p>Ve ingredientes, alérgenos y tiempo estimado antes de agregar al pedido.</p>
                </div>
                <div className="story-card__phone device">
                  <div className="device__screen">
                    <img
                      src="/screens/screen-2.jpeg"
                      alt="Detalle de producto en Vaiinilla con ingredientes, tiempo y selección"
                      width="738"
                      height="1600"
                      loading="lazy"
                    />
                  </div>
                </div>
              </article>
              <article className="story-card story-card--paper" data-reveal>
                <div className="story-card__meta">
                  <span>03</span>
                  <span>CONFIRMA</span>
                </div>
                <div className="story-card__copy">
                  <h3>Recoge cuando esté listo.</h3>
                  <p>Elige entrega para llevar, revisa tu método de pago y deja notas para cocina.</p>
                </div>
                <div className="story-card__phone device">
                  <div className="device__screen">
                    <img
                      src="/screens/screen-7.jpeg"
                      alt="Carrito de Vaiinilla con entrega para llevar y opciones de pago"
                      width="738"
                      height="1600"
                      loading="lazy"
                    />
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="audiences" id="ventajas">
          <div className="container">
            <div className="section-intro section-intro--audiences" data-reveal>
              <p className="eyebrow">Una misma red</p>
              <h2>
                Lo simple para quien pide.
                <br />
                <span className="lime-text">Lo claro para quien opera.</span>
              </h2>
            </div>
            <div className="audiences__grid">
              <article className="audience audience--student" data-reveal>
                <div className="audience__head">
                  <span className="audience__index">A / ALUMNO</span>
                  <span className="audience__mark" aria-hidden="true">
                    ↗
                  </span>
                </div>
                <h3>Come a tu ritmo.</h3>
                <p>
                  Descubre cafeterías, consulta lo disponible, personaliza tu producto y sigue el
                  avance de tu pedido.
                </p>
                <ul>
                  <li>Explora sin iniciar sesión</li>
                  <li>Menú, carrito y pago en un solo flujo</li>
                  <li>Estado del pedido hasta recogerlo</li>
                </ul>
                <Link className="audience__link" to="/pedir">
                  Pedir ahora <span aria-hidden="true">→</span>
                </Link>
              </article>
              <article className="audience audience--operator" id="para-cafeterias" data-reveal>
                <div className="audience__head">
                  <span className="audience__index">B / CAFETERÍA</span>
                  <span className="audience__mark" aria-hidden="true">
                    ✦
                  </span>
                </div>
                <h3>Opera con la vista completa.</h3>
                <p>
                  Administra menú, disponibilidad, pedidos y caja desde una operación conectada.
                  Cada rol ve lo que necesita.
                </p>
                <ul>
                  <li>Catálogo y productos actualizados</li>
                  <li>Pedidos activos e historial</li>
                  <li>Caja, entrega con QR y equipo por invitación</li>
                </ul>
                <a className="audience__link" href={STAFF_APP_URL} target="_blank" rel="noreferrer">
                  Abrir el panel <span aria-hidden="true">↗</span>
                </a>
              </article>
            </div>
            <div className="proof-strip" data-reveal>
              <span className="proof-strip__label">Diseñado alrededor de lo que ya pasa en una cafetería</span>
              <span className="proof-strip__line" />
              <span className="proof-strip__words">MENÚ · PEDIDOS · CAJA · ENTREGA</span>
            </div>
            <div className="surfaces" data-reveal>
              <div>
                <span className="surfaces__label">PARA QUIEN PIDE</span>
                <strong>Web y app</strong>
                <p>Descubre el menú, arma tu pedido y revisa su avance en vaiinilla.app.</p>
              </div>
              <div>
                <span className="surfaces__label">PARA QUIEN OPERA</span>
                <strong>Panel web</strong>
                <p>Administra catálogo, pedidos, caja y el equipo en app.vaiinilla.app.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="cta" id="cta">
          <div className="container">
            <div className="cta__card" data-reveal>
              <img
                className="cta__logo"
                src="/brand/vaiinilla-logo-splash-light.png"
                alt=""
                width="1448"
                height="1086"
                loading="lazy"
              />
              <div className="cta__copy">
                <p className="eyebrow">Cuando todo está en su lugar</p>
                <h2>
                  Tu siguiente pedido
                  <br />
                  <span>empieza aquí.</span>
                </h2>
                <p>Descubre cómo se siente una cafetería que fluye.</p>
                <Link className="btn btn--dark" to="/pedir">
                  Pedir ahora
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </PageShell>
  );
}
