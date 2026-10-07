import { Link } from 'react-router-dom';
import { STAFF_APP_URL } from '../types/api';
import { BuyerEntryLink, PageShell, useReveal } from '../components/shell';
import { StoreBadges } from '../components/store-badges';
import { LiveOrderPill } from '../components/live-order-pill';
import { OrderTrackerDemo } from '../components/order-tracker-demo';
import { StickyOrderBar } from '../components/sticky-order-bar';
import { StepsCarousel, type Step } from '../components/steps-carousel';

const STEPS: readonly Step[] = [
  {
    title: 'Escanea o busca tu lugar',
    body: 'Usa el QR de la mesa o elige el negocio de la lista.',
    image: '/screens/screen-table-code.jpg',
    alt: 'Teclado para ingresar el código de la mesa',
  },
  {
    title: 'Arma tu pedido y paga',
    body: 'Con tarjeta, con tu saldo o en efectivo al recoger.',
    image: '/screens/screen-cart.jpg',
    alt: 'Carrito con ramen y mac & cheese, entrega en mesa y botón Pagar',
  },
  {
    title: 'Recoge cuando esté listo',
    body: 'Te avisamos y te damos tu código para la barra.',
    image: '/screens/screen-orders.jpg',
    alt: 'Seguimiento del pedido paso a paso',
  },
];

const FEATURES = [
  { icon: '◎', title: 'Menú al día', body: 'Ves lo que hay hoy, con fotos, precios e ingredientes.' },
  { icon: '⌗', title: 'Mesa o para llevar', body: 'Escanea el QR de tu mesa o pide para recoger en barra.' },
  { icon: '◐', title: 'Saldo en Cartera', body: 'Paga con tu saldo Vaiinilla. Recargas en Caja.' },
  { icon: '↗', title: 'Sin crear cuenta', body: 'Tu primer pedido no pide registro. La cuenta es opcional.' },
] as const;

const STICKY_WATCH = ['#hero-actions', '#cta', '.footer'] as const;

export function HomePage() {
  useReveal();

  return (
    <PageShell marketing>
      <main id="main-content" className="home">
        <section className="hero" id="top">
          <div className="hero__grid container">
            <div className="hero__copy">
              <p className="hero__chip" data-reveal>
                <span className="status-dot" aria-hidden="true" /> Para cualquier negocio de comida
              </p>
              <h1 data-reveal>
                Pide sin fila.
                <br />
                <span className="highlight">Recoge y listo.</span>
              </h1>
              <p className="hero__lead" data-reveal>
                Escanea el QR del lugar, paga desde tu celular y te avisamos cuando tu pedido esté listo.
                Sin descargar nada.
              </p>
              <div className="hero__actions" id="hero-actions" data-reveal>
                <BuyerEntryLink className="btn btn--primary btn--big">Pedir</BuyerEntryLink>
                <Link className="text-link" to="/cuenta">
                  Ya tengo cuenta
                </Link>
              </div>
              <ul className="hero__proof" data-reveal>
                <li>Sin crear cuenta</li>
                <li>Tarjeta, saldo o efectivo</li>
                <li>Funciona en la web</li>
              </ul>
            </div>

            <div className="hero__visual" data-reveal>
              <div className="hero__halo" aria-hidden="true" />
              <div className="hero__device device">
                <div className="device__screen">
                  <img
                    src="/screens/screen-cart.jpg"
                    alt="Pedido en Vaiinilla con dos productos y el total a pagar"
                    width="720"
                    height="1476"
                    fetchPriority="high"
                  />
                </div>
              </div>
              <div className="hero__pill">
                <LiveOrderPill />
              </div>
              <img className="hero__vaini" src="/vaini/cutout-frente.png" alt="" width="640" height="860" />
            </div>
          </div>
        </section>

        <section className="how" id="como-funciona" aria-labelledby="how-title">
          <div className="container">
            <div className="section-head" data-reveal>
              <p className="eyebrow">Cómo pedir</p>
              <h2 id="how-title">
                Tres pasos.
                <br />
                <span className="lime-text">Cero filas.</span>
              </h2>
            </div>
            <StepsCarousel steps={STEPS} />
          </div>
        </section>

        <section className="track" id="seguimiento" aria-labelledby="track-title">
          <div className="container track__grid">
            <div className="track__copy" data-reveal>
              <p className="eyebrow eyebrow--dark">Seguimiento en vivo</p>
              <h2 id="track-title">
                Sabes justo
                <br />
                <span>cuándo está listo.</span>
              </h2>
              <p>
                Sigue tu pedido desde que pagas hasta que lo recoges. Cuando está listo, aparece tu código
                para la barra.
              </p>
            </div>
            <div className="track__demo" data-reveal>
              <OrderTrackerDemo />
            </div>
          </div>
        </section>

        <section className="features" id="producto" aria-labelledby="features-title">
          <div className="container">
            <div className="section-head" data-reveal>
              <h2 id="features-title">
                El menú del lugar,
                <br />
                en tu celular.
              </h2>
            </div>
            <ul className="features__grid">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="feature" data-reveal>
                  <span className="feature__icon" aria-hidden="true">
                    {feature.icon}
                  </span>
                  <strong>{feature.title}</strong>
                  <span>{feature.body}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="business" id="para-establecimientos" aria-labelledby="business-title">
          <div className="container">
            <div className="business__card" data-reveal>
              <div className="business__copy">
                <p className="eyebrow eyebrow--dark">Para negocios</p>
                <h2 id="business-title">¿Tienes un negocio de comida?</h2>
                <p>
                  Cafetería, club, snack o barra: recibe pedidos pagados, maneja tu menú y entrega con QR
                  desde un solo panel.
                </p>
                <ul>
                  <li>Menú y disponibilidad al día</li>
                  <li>Pedidos activos e historial</li>
                  <li>Caja, saldo y retiro con QR</li>
                </ul>
                <a className="btn btn--lime-outline" href={STAFF_APP_URL} target="_blank" rel="noreferrer">
                  Soy establecimiento <span aria-hidden="true">↗</span>
                </a>
              </div>
              <img
                className="business__vaini"
                src="/vaini/scene-taller.png"
                alt=""
                width="720"
                height="720"
                loading="lazy"
              />
            </div>
          </div>
        </section>

        <section className="apps" id="apps" aria-labelledby="apps-title">
          <div className="container apps__row" data-reveal>
            <div>
              <h2 id="apps-title">Ya funciona en la web.</h2>
              <p>Las apps de iPhone y Android vienen pronto.</p>
            </div>
            <StoreBadges />
          </div>
        </section>

        <section className="cta" id="cta">
          <div className="container">
            <div className="cta__card" data-reveal>
              <img className="cta__vaini" src="/vaini/cutout-frente.png" alt="" width="640" height="860" loading="lazy" />
              <div className="cta__copy">
                <h2>
                  Tu siguiente pedido
                  <br />
                  <span>empieza aquí.</span>
                </h2>
                <p>Elige tu lugar y pide en menos de un minuto.</p>
                <div className="cta__actions">
                  <BuyerEntryLink className="btn btn--dark btn--big">Pedir</BuyerEntryLink>
                  <Link className="text-link" to="/cuenta">
                    Ya tengo cuenta
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <StickyOrderBar watch={STICKY_WATCH}>
        <span className="sticky-order__text">
          <strong>Pide sin fila</strong>
          <small>Sin crear cuenta</small>
        </span>
        <BuyerEntryLink className="btn btn--primary">Pedir</BuyerEntryLink>
      </StickyOrderBar>
    </PageShell>
  );
}
