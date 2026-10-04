import { Fragment, useLayoutEffect, useRef, type CSSProperties, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatAmount } from '../lib/money';
import { resolvePickupQrToken, shouldShowPickupSurface } from '../lib/pickup-qr';
import {
  ORDER_FLOW,
  isActiveOrder,
  orderCollapsedHint,
  orderItemHeadline,
  orderRejectedItemsHint,
  orderMetaLine,
  orderCancelReason,
  orderOperationalHint,
  orderProgressFilled,
  orderStatusLabel,
  orderTrackSteps,
} from '../lib/order-labels';
import { RENTAL_STEPS, rentalStep } from '../lib/rental-tracking';
import type { OrderDetail } from '../types/api';
import { useHeightMorph } from '../lib/use-height-morph';
import { ArrivalButton } from './arrival-button';
import type { ArrivalClient } from '../lib/arrival-api';
import { CallWaiter } from './call-waiter';
import { OrderPickupPanel } from './order-pickup-panel';
import type { BuyerCallClient } from '../lib/mesero-api';

export function OrderTrackCard({
  order,
  expanded,
  onToggle,
  completeLink = true,
  toggle = true,
  selected = false,
  imageUrl = null,
  pickupToken = null,
  callClient,
  arrivalClient,
  callWaiter = true,
}: {
  order: OrderDetail;
  expanded: boolean;
  onToggle: () => void;
  completeLink?: boolean;
  toggle?: boolean;
  selected?: boolean;
  imageUrl?: string | null;
  pickupToken?: string | null;
  /** Injected in QA; otherwise built from the stored client context. */
  callClient?: BuyerCallClient;
  arrivalClient?: ArrivalClient;
  /** En escritorio el pedido seleccionado se ve también en el detalle: ahí vive el botón. */
  callWaiter?: boolean;
}) {
  const rental = Boolean(order.reserva);
  const rentalCurrent = rental ? rentalStep(order) : null;
  const barIcons = rental ? RENTAL_ICONS : TRACK_ICONS;
  const filled = rental
    ? RENTAL_STEPS.findIndex((item) => item.key === rentalCurrent) + 1
    : orderProgressFilled(order);
  const steps = orderTrackSteps(order);
  const inFlow = rental ? rentalCurrent !== null : ORDER_FLOW.includes(order.estado);
  const active = isActiveOrder(order);
  const statusLabel = orderStatusLabel(order);
  const showBar = inFlow;
  const cardRef = useRef<HTMLElement>(null);
  // Una foto que no carga vuelve a la mascota en vez de dejar el ícono de imagen rota.
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const pickupTokenResolved = pickupToken ?? resolvePickupQrToken(order);
  const showPickup = shouldShowPickupSurface(order);
  const collapsedStatusHint = orderCollapsedHint(order);
  const operationalHint = orderCancelReason(order) ?? orderOperationalHint(order);
  useHeightMorph(cardRef, expanded);

  useLayoutEffect(() => {
    if (!expanded) return;
    const card = cardRef.current;
    if (!card) return;
    const run = () => focusExpandedTrackCard(card);
    run();
    let inner = 0;
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(run);
    });
    const retry = window.setTimeout(run, 480);
    const images = [...card.querySelectorAll('img')];
    for (const img of images) {
      img.addEventListener('load', run);
    }
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(run) : null;
    ro?.observe(card);
    return () => {
      window.cancelAnimationFrame(outer);
      window.cancelAnimationFrame(inner);
      window.clearTimeout(retry);
      for (const img of images) {
        img.removeEventListener('load', run);
      }
      ro?.disconnect();
    };
  }, [expanded]);

  const className = [
    'alumno-track-card',
    expanded ? 'is-open' : null,
    selected ? 'is-selected' : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article
      ref={cardRef}
      className={className}
      aria-current={selected ? 'true' : undefined}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest('a, button, .alumno-track-card__follow, .alumno-callwaiter')) return;
        onToggle();
      }}
    >
      <header className="alumno-track-card__top">
        <span className="alumno-track-card__folio">#{order.folio}</span>
        <span className="alumno-track-card__pill">{statusLabel}</span>
      </header>
      <div className="alumno-track-card__body">
        {imageUrl && failedImage !== imageUrl ? (
          <img className="alumno-track-card__thumb" src={imageUrl} alt="" onError={() => setFailedImage(imageUrl)} />
        ) : (
          <div className="alumno-track-card__thumb alumno-track-card__thumb--vaini" aria-hidden="true">
            <img src="/vaini/cutout-frente.png" alt="" />
          </div>
        )}
        <div className="alumno-track-card__copy">
          <strong>{orderItemHeadline(order)}</strong>
          <p>{orderMetaLine(order)}</p>
        </div>
        <span className="alumno-track-card__price">{formatAmount(order.total)}</span>
      </div>
      {showBar ? (
        <div className="alumno-track-bar" aria-hidden="true">
          {barIcons.map((icon, index) => {
            const current = filled - 1;
            // Fuera de una renta, la barra usa los mismos pasos que la lista: así no se
            // contradicen (Preparando omitido, o entregado con todo hecho).
            const state =
              !rental && steps[index]
                ? steps[index]?.state ?? 'todo'
                : index < current ? 'done' : index === current ? 'current' : 'todo';
            return (
              <Fragment key={index}>
                <span className={`alumno-track-bar__node is-${state}`} style={{ '--i': index } as CSSProperties}>
                  <svg viewBox="0 0 24 24">
                    <path d={icon} />
                  </svg>
                </span>
                {index < barIcons.length - 1 ? (
                  <span
                    className={
                      (!rental && steps[index + 1] ? steps[index + 1]?.state !== 'todo' : index < current)
                        ? 'alumno-track-bar__rail is-on'
                        : 'alumno-track-bar__rail'
                    }
                    style={{ '--i': index } as CSSProperties}
                  />
                ) : null}
              </Fragment>
            );
          })}
        </div>
      ) : null}
      {showPickup && expanded ? null : (
        <p className="alumno-track-card__status">
          <strong>{statusLabel}</strong>
          {operationalHint ? ` ${operationalHint}` : collapsedStatusHint ? ` ${collapsedStatusHint}` : null}
        </p>
      )}
      {orderRejectedItemsHint(order) ? (
        <p className="alumno-track-card__status alumno-track-card__rejected">{orderRejectedItemsHint(order)}</p>
      ) : null}
      {/* Fuera del seguimiento: se llama al mesero sin abrir la tarjeta, y el botón no
          se vuelve a montar (ni a consultar) cada vez que se abre o se cierra. */}
      {active && callWaiter ? <CallWaiter order={order} client={callClient} /> : null}
      {expanded ? (
        <div className="alumno-track-card__follow" data-morph-in>
          <OrderPickupPanel
            order={order}
            token={pickupTokenResolved}
            stripeOrder={order.metodo_pago === 'stripe'}
          />
          <ArrivalButton order={order} client={arrivalClient} />
          <ol className="alumno-timeline">
            {steps.map((step, index) => (
              <li key={step.key} className={`is-${step.state}`}>
                <span className="alumno-timeline__mark" aria-hidden="true">
                  {step.state === 'done' ? <CheckIcon /> : step.state === 'skipped' ? '–' : index + 1}
                </span>
                <strong>{step.label}</strong>
                {step.hint ? <span className="alumno-timeline__hint">{step.hint}</span> : null}
              </li>
            ))}
          </ol>
          {operationalHint ? <p className="alumno-muted">{operationalHint}</p> : null}
          {completeLink ? (
            <Link className="alumno-btn alumno-btn--lime" to={`/cuenta/pedidos/${order.id}`}>
              Ver pedido completo
              <ArrowIcon />
            </Link>
          ) : null}
          {toggle && (active || inFlow) ? (
            <button className="alumno-track-card__toggle" type="button" onClick={onToggle} aria-expanded={expanded}>
              Ocultar seguimiento
              <ChevronIcon up />
            </button>
          ) : null}
        </div>
      ) : toggle && (active || inFlow) ? (
        <button className="alumno-track-card__toggle" type="button" onClick={onToggle} aria-expanded={expanded}>
          Ver seguimiento
          <ChevronIcon />
        </button>
      ) : null}
    </article>
  );
}

function focusExpandedTrackCard(card: HTMLElement) {
  if (typeof card.scrollIntoView !== 'function') return;
  if (isHiddenDeskClone(card)) return;
  card.scrollIntoView({ block: 'nearest', inline: 'nearest' });

  const nav = document.querySelector('.alumno-nav');
  if (!(nav instanceof HTMLElement)) return;
  const navBox = nav.getBoundingClientRect();
  const bottomNav =
    window.getComputedStyle(nav).position === 'fixed' && navBox.top > window.innerHeight * 0.55;
  if (!bottomNav) return;

  const gap = 12;
  const floor = navBox.top - gap;
  const toggle = card.querySelector('.alumno-track-card__follow .alumno-track-card__toggle');
  const cta = card.querySelector('.alumno-btn--lime');
  const timeline = card.querySelector('.alumno-timeline');
  const pickup = card.querySelector('.alumno-pickup');
  const ticket = card.closest('.alumno-detail-split')?.querySelector('.alumno-card--ticket');
  const ticketItem = ticket?.querySelector('.alumno-ticket-items li:last-child') ?? null;
  const ticketBottom =
    ticket instanceof HTMLElement && ticket.getBoundingClientRect().height > 2
      ? ticket.getBoundingClientRect().bottom
      : 0;
  const itemBottom =
    ticketItem instanceof HTMLElement && ticketItem.getBoundingClientRect().height > 2
      ? ticketItem.getBoundingClientRect().bottom
      : 0;
  const ticketTarget = itemBottom >= ticketBottom ? ticketItem : ticket;
  const target =
    (ticketTarget instanceof HTMLElement && ticketTarget.getBoundingClientRect().height > 2 && ticketTarget) ||
    (toggle instanceof HTMLElement && toggle.getBoundingClientRect().height > 2 && toggle) ||
    (cta instanceof HTMLElement && cta.getBoundingClientRect().height > 2 && cta) ||
    (timeline instanceof HTMLElement ? timeline : null) ||
    (pickup instanceof HTMLElement ? pickup : null);
  if (!target) return;

  const targetBox = target.getBoundingClientRect();
  if (targetBox.bottom <= floor) return;
  scrollPageBy(targetBox.bottom - floor);
}

function scrollPageBy(delta: number) {
  if (!delta) return;
  const instant = { top: delta, left: 0, behavior: 'instant' as ScrollBehavior };
  if (typeof window.scrollBy === 'function') {
    try {
      window.scrollBy(instant);
    } catch {
      window.scrollBy({ top: delta, left: 0, behavior: 'auto' });
    }
  }
  const movers = [document.scrollingElement, document.documentElement, document.body];
  for (const node of movers) {
    if (!node) continue;
    const before = node.scrollTop;
    if (typeof node.scrollBy === 'function') {
      try {
        node.scrollBy(instant);
      } catch {
        node.scrollBy({ top: delta, left: 0, behavior: 'auto' });
      }
    }
    if (node.scrollTop !== before) return;
    node.scrollTop = before + delta;
    if (node.scrollTop !== before) return;
  }
}

function isHiddenDeskClone(card: HTMLElement): boolean {
  const pane = card.closest('.alumno-orders-desk__detail');
  if (!pane) return false;
  if (window.getComputedStyle(pane).display === 'none') return true;
  return card.getBoundingClientRect().height < 8;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9.2 16.2 4.8 11.8l1.4-1.4 3 3 8.6-8.6 1.4 1.4-10 10Z"
      />
    </svg>
  );
}

function ChevronIcon({ up }: { up?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      {up ? (
        <path fill="currentColor" d="m12 8 6 6H6l6-6Z" />
      ) : (
        <path fill="currentColor" d="m12 16-6-6h12l-6 6Z" />
      )}
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M13.2 5.2 19 11H4v2h15l-5.8 5.8 1.4 1.4L23 12l-8.4-8.2-1.4 1.4Z" />
    </svg>
  );
}

// One glyph per tracking state, like Android's trackingIcon: receipt, paid, kitchen, ready bell, delivered seal.
const TRACK_ICONS = [
  'M7 3h10v18l-2.5-1.6L12 21l-2.5-1.6L7 21V3Zm3 5h4m-4 4h4',
  'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-11.5 0 2.4 2.4 4.6-4.8',
  'M7 3v8m-2-8v4a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 1.2-3 3.4-3 6v4h3',
  'M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 4a2 2 0 0 0 4 0',
  'M12 3l2.3 1.6 2.8-.1.9 2.6 2.2 1.7-.8 2.7.8 2.7-2.2 1.7-.9 2.6-2.8-.1L12 21l-2.3-1.6-2.8.1-.9-2.6L3.8 15.2l.8-2.7-.8-2.7L6 8.1l.9-2.6 2.8.1L12 3Zm-3 9.2 2 2 4-4.4',
];

// Rental steps reuse the receipt and paid-check glyphs, then play (en juego) and flag (terminada).
const RENTAL_ICONS = [TRACK_ICONS[0], TRACK_ICONS[1], 'M8 5v14l11-7L8 5Z', 'M6 21V4m0 0h12l-2.5 4L18 12H6'];
