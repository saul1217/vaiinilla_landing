import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { formatAmount } from '../lib/money';
import {
  ORDER_FLOW,
  ORDER_STATUS_HINT,
  ORDER_STATUS_LABEL,
  isActiveOrderStatus,
  orderItemHeadline,
  orderMetaLine,
  orderProgressFilled,
  orderTrackSteps,
} from '../lib/order-labels';
import type { OrderDetail } from '../types/api';

export function OrderTrackCard({
  order,
  expanded,
  onToggle,
  completeLink = true,
  toggle = true,
  imageUrl = null,
}: {
  order: OrderDetail;
  expanded: boolean;
  onToggle: () => void;
  completeLink?: boolean;
  toggle?: boolean;
  imageUrl?: string | null;
}) {
  const filled = orderProgressFilled(order);
  const steps = orderTrackSteps(order);
  const inFlow = ORDER_FLOW.includes(order.estado);
  const showBar = inFlow;
  const followRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded || !completeLink) return;
    const cta = followRef.current?.querySelector<HTMLElement>('.alumno-btn');
    if (typeof cta?.scrollIntoView !== 'function') return;
    const nav = document.querySelector('.alumno-nav');
    const navTop = nav instanceof HTMLElement ? nav.getBoundingClientRect().top : window.innerHeight;
    const obscured = cta.getBoundingClientRect().bottom > navTop - 12;
    if (obscured) {
      cta.scrollIntoView({ block: 'end', inline: 'nearest', behavior: 'smooth' });
    }
  }, [completeLink, expanded]);

  return (
    <article
      className={expanded ? 'alumno-track-card is-open' : 'alumno-track-card'}
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
      <p className="alumno-track-card__status">
        <strong>{ORDER_STATUS_LABEL[order.estado]}</strong> {ORDER_STATUS_HINT[order.estado]}
      </p>
      {expanded ? (
        <div className="alumno-track-card__follow" ref={followRef}>
          <ol className="alumno-timeline">
            {steps.map((step, index) => (
              <li key={step.key} className={`is-${step.state}`}>
                <span className="alumno-timeline__mark" aria-hidden="true">
                  {step.state === 'done' ? <CheckIcon /> : index + 1}
                </span>
                <strong>{step.label}</strong>
                <span className="alumno-timeline__hint">{step.hint}</span>
              </li>
            ))}
          </ol>
          {toggle && (isActiveOrderStatus(order.estado) || inFlow) ? (
            <button className="alumno-track-card__toggle" type="button" onClick={onToggle} aria-expanded={expanded}>
              Ocultar seguimiento
              <ChevronIcon up />
            </button>
          ) : null}
          {completeLink ? (
            <Link className="alumno-btn alumno-btn--lime" to={`/cuenta/pedidos/${order.id}`}>
              Ver pedido completo
              <ArrowIcon />
            </Link>
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
