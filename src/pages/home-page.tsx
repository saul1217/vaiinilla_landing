import { Link } from 'react-router-dom';
import { STAFF_APP_URL } from '../types/api';
import { BuyerEntryLink, PageShell, useReveal } from '../components/shell';
import { StoreBadges } from '../components/store-badges';

const TRACK = [
  { label: 'Pago confirmado', hint: 'Stripe confirma el cargo.' },
  { label: 'Cobrado', hint: 'Cocina ya tiene la comanda.' },
  { label: 'Preparando', hint: 'Tu comida está en marcha.' },
  { label: 'Listo', hint: 'Código y QR de retiro.' },
  { label: 'Entregado', hint: 'Pedido completado.' },
] as const;

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
              <h1 data-reveal>
                Más recreo.
                <br />
                <span className="highlight">Menos fila.</span>
              </h1>
              <p className="hero__lead" data-reveal>
                Pide en tu cafetería escolar desde la web. Menú, pago y retiro, sin hacer fila.
              </p>
              <div className="hero__actions" data-reveal>
                <BuyerEntryLink className="btn btn--primary">Pedir</BuyerEntryLink>
                <Link className="text-link" to="/cuenta">
                  Ya tengo cuenta
                </Link>
              </div>
            </div>

            <div className="hero__visual" data-reveal>
              <div className="hero__panel">
                <div className="hero__panel-top">
                  <span>Menú del día</span>
                  <span>vaiinilla.app</span>
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
        </section>

        <section className="product" id="producto" aria-labelledby="product-title">
          <div className="container product__inner">
            <img
              className="product__vaini"
              src="/vaini/cutout-frente.png"
              alt=""
              width="640"
              height="860"
            />
            <div className="product__copy">
              <h2 id="product-title">
                La cafetería del campus,
                <br />
                en tu celular.
              </h2>
              <p>
                Vaiinilla es para alumnos. Eliges tu establecimiento, ves lo que hay hoy, pagas con
                tarjeta o saldo y recoges cuando está listo.
              </p>
            </div>
            <ul className="product__facts">
              <li>
                <strong>Menú en vivo</strong>
                <span>Disponibilidad, ingredientes y alérgenos antes de armar el carrito.</span>
              </li>
              <li>
                <strong>Cartera</strong>
                <span>Saldo Vaiinilla para pagar en la cafetería. La recarga se hace en Caja.</span>
              </li>
              <li>
                <strong>Mis pedidos</strong>
                <span>Seguimiento hasta recoger: cobrado, preparando, listo, entregado.</span>
              </li>
              <li>
                <strong>Mesa o para llevar</strong>
                <span>Escanea el QR de la mesa o pide para recoger en barra.</span>
              </li>
            </ul>
          </div>
        </section>

        <section className="story" id="como-funciona">
          <div className="container">
            <div className="story__intro" data-reveal>
              <h2>
                Tres toques.
                <br />
                <span className="lime-text">Pedido en camino.</span>
              </h2>
              <p>Entra desde vaiinilla.app. El menú se puede ver sin iniciar sesión.</p>
            </div>
            <div className="story__grid">
              <article className="story-card story-card--dark" data-reveal>
                <div className="story-card__meta">
                  <span>Elige sede</span>
                </div>
                <div className="story-card__copy">
                  <h3>Encuentra tu cafetería.</h3>
                  <p>Si ya pediste aquí, volvemos a esa sede. Si no, eliges en el listado del campus.</p>
                </div>
                <div className="story-card__phone device">
                  <div className="device__screen">
                    <img
                      src="/screens/screen-8.jpeg"
                      alt="Pantalla para elegir cafetería en Vaiinilla"
                      width="738"
                      height="1600"
                      loading="lazy"
                    />
                  </div>
                </div>
              </article>
              <article className="story-card story-card--lime" data-reveal>
                <div className="story-card__meta">
                  <span>Arma el pedido</span>
                </div>
                <div className="story-card__copy">
                  <h3>Lo que se te antoja.</h3>
                  <p>Personaliza, revisa el total y paga con Stripe o con tu saldo.</p>
                </div>
                <div className="story-card__phone device">
                  <div className="device__screen">
                    <img
                      src="/screens/screen-2.jpeg"
                      alt="Detalle de producto en Vaiinilla"
                      width="738"
                      height="1600"
                      loading="lazy"
                    />
                  </div>
                </div>
              </article>
              <article className="story-card story-card--paper" data-reveal>
                <div className="story-card__meta">
                  <span>Recoge</span>
                </div>
                <div className="story-card__copy">
                  <h3>Cuando esté listo.</h3>
                  <p>Te avisamos. En Listo aparece el código y el QR de retiro, una sola vez.</p>
                </div>
                <div className="story-card__phone device">
                  <div className="device__screen">
                    <img
                      src="/screens/screen-7.jpeg"
                      alt="Carrito de Vaiinilla con entrega y pago"
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

        <section className="track" id="seguimiento" aria-labelledby="track-title">
          <div className="container track__grid">
            <div className="track__copy" data-reveal>
              <h2 id="track-title">
                Ves cada paso
                <br />
                hasta la barra.
              </h2>
              <p>
                En Mis pedidos el estado no es un misterio. Si pagaste con tarjeta, el primer paso es
                Pago confirmado. En Listo, el folio y el QR salen juntos para recoger.
              </p>
              <ol className="track__flow" aria-label="Estados del pedido">
                {TRACK.map((step, index) => (
                  <li key={step.label}>
                    <span className="track__n">{index + 1}</span>
                    <strong>{step.label}</strong>
                    <span>{step.hint}</span>
                  </li>
                ))}
              </ol>
            </div>
            <figure className="track__visual" data-reveal>
              <div className="device device--track">
                <div className="device__screen">
                  <img
                    src="/refs/android/orders-expand.jpg"
                    alt="Pedido listo en Vaiinilla con seguimiento y retiro"
                    width="720"
                    height="1280"
                    loading="lazy"
                  />
                </div>
              </div>
              <figcaption>Código de retiro y QR solo cuando el pedido está Listo.</figcaption>
            </figure>
          </div>
        </section>

        <section className="wallet-band" id="cartera" aria-labelledby="wallet-title">
          <div className="container wallet-band__grid">
            <figure className="wallet-band__visual" data-reveal>
              <div className="device device--wallet">
                <div className="device__screen">
                  <img
                    src="/refs/android/wallet.jpg"
                    alt="Cartera Vaiinilla con saldo, pedidos y QR de recarga"
                    width="720"
                    height="1440"
                    loading="lazy"
                  />
                </div>
              </div>
            </figure>
            <div className="wallet-band__copy" data-reveal>
              <h2 id="wallet-title">Saldo en Cartera. Recarga en Caja.</h2>
              <p>
                La Cartera muestra tu saldo Vaiinilla, tus pedidos y el QR para recargar. El personal
                de Caja carga el saldo en el mostrador. Aquí no se recarga con tarjeta.
              </p>
              <p>
                Paga el pedido con saldo, con Stripe o en efectivo al recoger, según lo que abra tu
                cafetería.
              </p>
            </div>
          </div>
        </section>

        <section className="apps" id="apps" aria-labelledby="apps-title">
          <div className="container apps__grid">
            <div className="apps__copy">
              <h2 id="apps-title">
                Ya está en la web.
                <br />
                Las apps, en camino.
              </h2>
              <p>
                Pide hoy en vaiinilla.app. Las apps nativas de iPhone y Android están en revisión en
                App Store y Google Play. Cuando las acepten, estos mismos botones abren la ficha oficial.
              </p>
              <StoreBadges />
            </div>
            <img
              className="apps__vaini"
              src="/vaini/scene-laptop.png"
              alt=""
              width="720"
              height="720"
              loading="lazy"
            />
          </div>
        </section>

        <section className="audiences" id="ventajas">
          <div className="container">
            <div className="audiences__intro" data-reveal>
              <h2>
                Para quien pide.
                <br />
                <span className="lime-text">Y para quien opera.</span>
              </h2>
            </div>
            <div className="audiences__grid">
              <article className="audience audience--student" data-reveal>
                <div className="audience__head">
                  <span className="audience__index">Alumno</span>
                </div>
                <h3>Come a tu ritmo.</h3>
                <p>
                  Descubre cafeterías del campus, consulta lo disponible, paga y sigue el pedido hasta
                  recogerlo.
                </p>
                <ul>
                  <li>Explora el menú sin iniciar sesión</li>
                  <li>Carrito, Stripe y saldo en un solo flujo</li>
                  <li>Código de retiro cuando está Listo</li>
                </ul>
                <BuyerEntryLink className="audience__link">
                  Pedir <span aria-hidden="true">→</span>
                </BuyerEntryLink>
              </article>
              <article className="audience audience--operator" id="para-cafeterias" data-reveal>
                <div className="audience__head">
                  <span className="audience__index">Establecimiento</span>
                </div>
                <h3>Opera con la vista completa.</h3>
                <p>
                  El panel del equipo vive aparte, en app.vaiinilla.app. Menú, pedidos, caja y
                  entrega con QR.
                </p>
                <ul>
                  <li>Catálogo y productos actualizados</li>
                  <li>Pedidos activos e historial</li>
                  <li>Caja, QR de retiro y equipo por invitación</li>
                </ul>
                <a className="audience__link" href={STAFF_APP_URL} target="_blank" rel="noreferrer">
                  Soy establecimiento <span aria-hidden="true">↗</span>
                </a>
              </article>
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
              <img className="cta__vaini" src="/vaini/cutout-lado.png" alt="" width="480" height="640" />
              <div className="cta__copy">
                <h2>
                  Tu siguiente pedido
                  <br />
                  <span>empieza aquí.</span>
                </h2>
                <p>Entra a pedir en tu cafetería. Si ya tienes cuenta, inicia sesión.</p>
                <div className="cta__actions">
                  <BuyerEntryLink className="btn btn--dark">Pedir</BuyerEntryLink>
                  <Link className="text-link" to="/cuenta">
                    Ya tengo cuenta
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </PageShell>
  );
}
