import { Link } from 'react-router-dom';
import { STAFF_APP_URL } from '../types/api';
import { BuyerEntryLink, PageShell, useReveal } from '../components/shell';
import { StoreBadges } from '../components/store-badges';
import { OrderTrackerDemo } from '../components/order-tracker-demo';
import { StickyOrderBar } from '../components/sticky-order-bar';
import { StepsCarousel, type Step } from '../components/steps-carousel';
import { PhoneShot } from '../components/phone-shot';
import { CafeFilm } from '../components/cafe-film';
import { markBuyerExplore } from '../lib/buyer-entry';

const STEPS: readonly Step[] = [
  {
    title: 'Entra al menú',
    body: 'Escanea el QR de la mesa, escribe el código o busca el establecimiento.',
    image: '/screens/screen-entry.jpg',
    alt: 'Pantalla para escanear QR, escribir código de mesa o buscar establecimiento',
    statusColor: '#f4f1e7',
  },
  {
    title: 'Arma tu pedido',
    body: 'Elige platillos, personaliza opciones y revisa el total antes de pagar.',
    image: '/screens/screen-cart.jpg',
    alt: 'Carrito con productos del menú y botón para pagar',
    statusColor: '#f4f1e7',
  },
  {
    title: 'Recoge cuando esté listo',
    body: 'Sigue el estado en vivo. En barra te damos un código; en mesa te lo llevan.',
    image: '/screens/screen-orders.jpg',
    alt: 'Lista de pedidos con seguimiento paso a paso',
    statusColor: '#f4f1e7',
  },
];

const FEATURES = [
  {
    icon: 'M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z',
    title: 'Menú al día',
    body: 'Fotos, precios, categorías y opciones como en el local.',
  },
  {
    icon: 'M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h2v2h-2zM19 19h2v2h-2zM19 15h2M15 19h2',
    title: 'Mesa o para llevar',
    body: 'QR de mesa, código de cuatro dígitos o recoger en barra.',
  },
  {
    icon: 'M20 7H5a2 2 0 0 1 0-4h13v4M3 5v14a2 2 0 0 0 2 2h15V7M16 14h.01',
    title: 'Cartera Vaiinilla',
    body: 'Paga con saldo recargado en caja, además de tarjeta o efectivo.',
  },
  {
    icon: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
    title: 'Llamar al mesero',
    body: 'Desde la mesa pides cubiertos, la cuenta o ayuda sin levantarte.',
  },
  {
    icon: 'M22 12h-4l-3 9L9 3l-3 9H2',
    title: 'Seguimiento en vivo',
    body: 'Sabes cuándo preparan tu pedido y cuándo está listo para recoger.',
  },
  {
    icon: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    title: 'Reserva de canchas',
    body: 'En clubes con canchas puedes reservar horario y pagar desde la app.',
  },
] as const;

const HERO_PATHS = [
  {
    title: 'Escanear QR',
    body: 'El de tu mesa o de la tienda.',
    icon: 'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8h8M8 12h6M8 16h4',
  },
  {
    title: 'Buscar lugar',
    body: 'Nombre del restaurante o cafetería.',
    icon: 'M21 21l-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z',
  },
  {
    title: 'Código de mesa',
    body: 'Cuatro dígitos junto al QR.',
    icon: 'M4 7h16M8 7V5h8v2M6 11h12v8H6z',
  },
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
                <span className="status-dot" aria-hidden="true" /> Para restaurantes, cafés, bares y más
              </p>
              <h1 data-reveal>
                Escanea tu mesa,
                <br />
                <span className="highlight">pide y listo.</span>
              </h1>
              <p className="hero__lead" data-reveal>
                Entra con el QR, busca tu lugar o usa el código de mesa. Arma el pedido desde el celular, paga con
                tarjeta, saldo en Cartera o efectivo al recoger, y sigue el estado hasta que te lo entreguen.
              </p>
              <div className="hero__actions" id="hero-actions" data-reveal>
                <BuyerEntryLink className="btn btn--primary btn--big">Empezar a pedir</BuyerEntryLink>
                <Link className="text-link" to="/cuenta">
                  Ya tengo cuenta
                </Link>
              </div>
              <ul className="hero__paths" data-reveal aria-label="Formas de entrar">
                {HERO_PATHS.map((path) => (
                  <li key={path.title}>
                    <Link className="hero__path" to="/pedir" onClick={markBuyerExplore}>
                      <span className="hero__path-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path d={path.icon} />
                        </svg>
                      </span>
                      <span className="hero__path-copy">
                        <strong>{path.title}</strong>
                        <small>{path.body}</small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <ul className="hero__proof" data-reveal>
                <li>Sin crear cuenta para empezar</li>
                <li>Funciona en la web hoy</li>
                <li>Paga como prefieras al cerrar</li>
              </ul>
            </div>

            <div className="hero__visual" data-reveal>
              <div className="hero__halo" aria-hidden="true" />
              <PhoneShot
                className="hero__device"
                src="/screens/screen-entry.jpg"
                alt="Pantalla inicial para escanear QR, buscar establecimiento o usar código de mesa"
                width={780}
                height={1688}
                statusColor="#f4f1e7"
                priority
              />
            </div>
          </div>
        </section>

        <section className="how" id="como-funciona" aria-labelledby="how-title">
          <div className="container">
            <div className="section-head" data-reveal>
              <p className="eyebrow">Cómo funciona</p>
              <h2 id="how-title">
                Tres pasos
                <br />
                <span className="lime-text">desde tu celular.</span>
              </h2>
            </div>
            <StepsCarousel steps={STEPS} />
          </div>
        </section>

        <section className="at-table" id="en-mesa" aria-labelledby="at-table-title">
          <div className="container at-table__grid">
            <div className="at-table__copy" data-reveal>
              <p className="eyebrow">En la mesa</p>
              <h2 id="at-table-title">
                Pide sin
                <br />
                <span className="lime-text">esperar al mesero.</span>
              </h2>
              <p>
                Cuando estás sentado, el menú ya sabe tu mesa. Puedes llamar al mesero para cubiertos, la cuenta o
                cualquier detalle, y ver cómo va tu pedido hasta que te lo traen.
              </p>
            </div>
            <div className="at-table__phones" data-reveal>
              <PhoneShot
                className="at-table__phone at-table__phone--back"
                src="/screens/screen-table-order.jpg"
                alt="Pedido recibido en mesa con seguimiento Pedido, Preparando y Listo"
                width={780}
                height={1688}
                statusColor="#f4f1e7"
              />
              <PhoneShot
                className="at-table__phone at-table__phone--front"
                src="/screens/screen-checkout.jpg"
                alt="Revisión del pedido antes de pagar con total y forma de entrega"
                width={780}
                height={1688}
                statusColor="#f4f1e7"
              />
            </div>
          </div>
        </section>

        <section className="cafe" id="del-otro-lado" aria-labelledby="cafe-title">
          <div className="container cafe__grid">
            <div className="section-head cafe__head" data-reveal>
              <p className="eyebrow">Del otro lado de la barra</p>
              <h2 id="cafe-title">
                Tu pedido llega
                <br />
                <span className="lime-text">directo al café.</span>
              </h2>
              <p>En cuanto pagas, el café lo ve en su panel y empieza a prepararlo. Sin papelitos ni nombres a gritos.</p>
            </div>
            <div data-reveal>
              <CafeFilm />
            </div>
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
                Sigue tu pedido desde que lo envías hasta que lo recoges. Cuando está listo en barra, aparece tu código
                de recogida.
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
              <p className="eyebrow">Qué incluye</p>
              <h2 id="features-title">
                Todo lo que necesitas
                <br />
                <span className="lime-text">para pedir bien.</span>
              </h2>
            </div>
            <ul className="features__grid features__grid--six">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="feature" data-reveal>
                  <span className="feature__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d={feature.icon} />
                    </svg>
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
                  Cafetería, club, snack o barra: recibe pedidos pagados, maneja tu menú y entrega con QR desde un solo
                  panel.
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
              <h2 id="apps-title">Pide hoy en la web.</h2>
              <p>Las apps de iPhone y Android vienen pronto; tu cuenta y pedidos siguen contigo.</p>
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
                <p>Escanea el QR de tu mesa o busca tu lugar y pide en menos de un minuto.</p>
                <div className="cta__actions">
                  <BuyerEntryLink className="btn btn--dark btn--big">Empezar a pedir</BuyerEntryLink>
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
          <strong>Escanea y pide</strong>
          <small>Menú en tu celular</small>
        </span>
        <BuyerEntryLink className="btn btn--primary">Pedir</BuyerEntryLink>
      </StickyOrderBar>
    </PageShell>
  );
}
