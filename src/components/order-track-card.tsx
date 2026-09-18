import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { formatAmount } from '../lib/money';
import { resolvePickupQrToken, shouldShowPickupSurface } from '../lib/pickup-qr';
import {
  ORDER_FLOW,
  ORDER_STATUS_LABEL,
  isActiveOrderStatus,
  orderCollapsedStatusHint,
  orderItemHeadline,
  orderMetaLine,
  orderProgressFilled,
  orderTrackSteps,
} from '../lib/order-labels';
import type { OrderDetail } from '../types/api';
import { OrderPickupPanel } from './order-pickup-panel';

export function OrderTrackCard({
  order,
  expanded,
  onToggle,
  completeLink = true,
  toggle = true,
  compact = false,
  selected = false,
  imageUrl = null,
  pickupToken = null,
}: {
  order: OrderDetail;
  expanded: boolean;
  onToggle: () => void;
  completeLink?: boolean;
  toggle?: boolean;
  compact?: boolean;
  selected?: boolean;
  imageUrl?: string | null;
  pickupToken?: string | null;
}) {
  const filled = orderProgressFilled(order);
  const steps = orderTrackSteps(order);
  const inFlow = ORDER_FLOW.includes(order.estado);
  const showBar = inFlow;
  const cardRef = useRef<HTMLElement>(null);
  const pickupTokenResolved = pickupToken ?? resolvePickupQrToken(order);
  const showPickup = shouldShowPickupSurface(order);
  const collapsedStatusHint = orderCollapsedStatusHint(order.estado);
  const collapsedCompact = compact && !expanded;

  useLayoutEffect(() => {
    if (!expanded || !toggle) return;
    const card = cardRef.current;
    if (!card) return;
    let inner = 0;
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => {
        focusExpandedTrackCard(card);
      });
    });
    return () => {
      window.cancelAnimationFrame(outer);
      window.cancelAnimationFrame(inner);
    };
  }, [expanded, toggle]);

  const className = [
    'alumno-track-card',
    expanded ? 'is-open' : null,
    collapsedCompact ? 'is-compact' : null,
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
        if (target.closest('a, button, .alumno-track-card__follow')) return;
        onToggle();
      }}
    >
      <header className="alumno-track-card__top">
        <span className="alumno-track-card__folio">#{order.folio}</span>
        <span className="alumno-track-card__pill">{ORDER_STATUS_LABEL[order.estado]}</span>
      </header>
      <div className="alumno-track-card__body">
        {imageUrl ? (
          <img className="alumno-track-card__thumb" src={imageUrl} alt="" />
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
          {ORDER_FLOW.map((step, index) => (
            <span key={step} className={index < filled ? 'is-on' : undefined} />
          ))}
        </div>
      ) : null}
      {showPickup && expanded ? null : (
        <p className="alumno-track-card__status">
          <strong>{ORDER_STATUS_LABEL[order.estado]}</strong>
          {collapsedStatusHint ? ` ${collapsedStatusHint}` : null}
        </p>
      )}
      {expanded ? (
        <div className="alumno-track-card__follow">
          <OrderPickupPanel
            order={order}
            token={pickupTokenResolved}
            stripeOrder={order.metodo_pago === 'stripe'}
          />
          <ol className="alumno-timeline">
            {steps.map((step, index) => (
              <li key={step.key} className={`is-${step.state}`}>
                <span className="alumno-timeline__mark" aria-hidden="true">
                  {step.state === 'done' ? <CheckIcon /> : index + 1}
                </span>
                <strong>{step.label}</strong>
                {step.hint ? <span className="alumno-timeline__hint">{step.hint}</span> : null}
              </li>
            ))}
          </ol>
          {completeLink ? (
            <Link className="alumno-btn alumno-btn--lime" to={`/cuenta/pedidos/${order.id}`}>
              Ver pedido completo
              <ArrowIcon />
            </Link>
          ) : null}
          {toggle && (isActiveOrderStatus(order.estado) || inFlow) ? (
            <button className="alumno-track-card__toggle" type="button" onClick={onToggle} aria-expanded={expanded}>
              Ocultar seguimiento
              <ChevronIcon up />
            </button>
          ) : null}
        </div>
      ) : toggle && (isActiveOrderStatus(order.estado) || inFlow) ? (
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
  card.scrollIntoView({ block: 'nearest', inline: 'nearest' });

  const nav = document.querySelector('.alumno-nav');
  if (!(nav instanceof HTMLElement) || typeof window.scrollBy !== 'function') return;
  const navBox = nav.getBoundingClientRect();
  const bottomNav =
    window.getComputedStyle(nav).position === 'fixed' && navBox.top > window.innerHeight * 0.55;
  if (!bottomNav) return;

  const gap = 12;
  const floor = navBox.top - gap;
  const pickup = card.querySelector('.alumno-pickup');
  const pickupBox = pickup instanceof HTMLElement ? pickup.getBoundingClientRect() : null;
  if (!pickupBox || pickupBox.height < 2) return;

  if (pickupBox.bottom <= floor) return;
  const extra = pickupBox.bottom - floor;
  const room = Math.max(0, pickupBox.top - 8);
  if (room > 0) window.scrollBy({ top: Math.min(extra, room), left: 0, behavior: 'auto' });
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
