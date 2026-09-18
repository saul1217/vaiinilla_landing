import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rememberPickupQrToken } from '../lib/pickup-qr';
import type { OrderDetail } from '../types/api';
import { OrderTrackCard } from './order-track-card';

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,qr') },
}));

function order(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    id: 'ord-1',
    folio: 1,
    fecha_operativa: '2026-09-18',
    estado: 'listo',
    metodo_pago: 'stripe',
    destino: 'para_llevar',
    espacio: null,
    subtotal: '16.50',
    ahorro_combinado: '0.00',
    cashback_otorgado: '0.00',
    total: '16.50',
    version: 1,
    creado_en: '2026-09-18T12:00:00Z',
    actualizado_en: '2026-09-18T12:00:00Z',
    notas_cocina: null,
    usuario: { nombre: 'Ana', matricula: null },
    items: [
      {
        id: 1,
        producto_id: 1,
        nombre_producto: 'Chicharrones',
        estacion_preparacion: 'caja',
        cantidad: 1,
        precio_digital_unitario: '16.50',
        subtotal: '16.50',
        opciones: [],
      },
    ],
    pago: {
      payment_attempt_id: 'attempt-1',
      payment_intent_id: 'pi_1',
      stripe_account_id: 'acct_1',
      payment_status: 'confirmado',
    },
    ...overrides,
  };
}

function renderCard(next: OrderDetail, pickupToken: string | null = null) {
  return render(
    <MemoryRouter>
      <OrderTrackCard order={next} expanded onToggle={() => undefined} pickupToken={pickupToken} />
    </MemoryRouter>,
  );
}

describe('OrderTrackCard pickup', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
  });

  it('en listo colapsado deja solo Listo; Recógelo vive en el tracking expandido', () => {
    render(
      <MemoryRouter>
        <OrderTrackCard order={order()} expanded={false} onToggle={() => undefined} />
      </MemoryRouter>,
    );
    expect(document.querySelector('.alumno-track-card__status')).toHaveTextContent(/^Listo$/);
    expect(document.querySelector('.alumno-track-card__status')).not.toHaveTextContent(/recógelo/i);
    expect(screen.queryByRole('region', { name: /código de retiro/i })).not.toBeInTheDocument();
    expect((document.body.textContent?.match(/Recógelo en la barra/gi) ?? []).length).toBe(0);
  });

  it('en split lista+detalle Recógelo sale una vez, en el pickup', () => {
    render(
      <MemoryRouter>
        <OrderTrackCard order={order()} expanded={false} selected onToggle={() => undefined} />
        <OrderTrackCard order={order()} expanded onToggle={() => undefined} pickupToken="pickup-secret" />
      </MemoryRouter>,
    );
    const listRow = document.querySelector('.alumno-track-card.is-selected');
    expect(listRow).toHaveAttribute('aria-current', 'true');
    expect(listRow?.querySelector('.alumno-track-card__status')).toHaveTextContent(/^Listo$/);
    expect(listRow?.querySelector('.alumno-pickup')).toBeNull();
    const statuses = [...document.querySelectorAll('.alumno-track-card__status')];
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toHaveTextContent(/^Listo$/);
    expect(screen.getByRole('region', { name: /código de retiro/i })).toHaveTextContent(/recógelo en la barra/i);
    expect((document.body.textContent?.match(/Recógelo en la barra/gi) ?? []).length).toBe(1);
  });

  it('en listo muestra folio de retiro aunque no haya token', () => {
    renderCard(order({ qr_token: undefined }));
    const region = screen.getByRole('region', { name: /código de retiro/i });
    expect(region).toHaveTextContent('#1');
    expect(region).toHaveTextContent(/recógelo en la barra/i);
    expect((document.body.textContent?.match(/Recógelo en la barra/gi) ?? []).length).toBe(1);
    expect(document.querySelector('.alumno-track-card__status')).toBeNull();
    expect(screen.queryByRole('img', { name: /código qr/i })).not.toBeInTheDocument();
    expect(document.querySelector('.alumno-timeline li.is-current .alumno-timeline__mark')?.textContent).toBe(
      '4',
    );
    expect(document.querySelectorAll('.alumno-timeline li.is-done svg')).toHaveLength(3);
  });

  it('en compacto esconde chrome extra pero sigue tappable', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <OrderTrackCard order={order({ folio: 95, estado: 'por_cobrar' })} expanded={false} compact onToggle={onToggle} />
      </MemoryRouter>,
    );
    expect(document.querySelector('.alumno-track-card')).toHaveClass('is-compact');
    expect(document.querySelector('.alumno-track-card__status')).toHaveTextContent(/por cobrar/i);
    expect(screen.getByRole('button', { name: /ver seguimiento/i })).toBeInTheDocument();
    await user.click(screen.getByText('#95'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('al expandir enfoca la card con scrollIntoView nearest', () => {
    renderCard(order());
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      block: 'nearest',
      inline: 'nearest',
    });
  });

  it('si el CTA queda bajo el nav móvil, hace scroll para dejarlo arriba', () => {
    const scrollBy = vi.fn();
    vi.stubGlobal('scrollBy', scrollBy);
    const nav = document.createElement('nav');
    nav.className = 'alumno-nav';
    document.body.appendChild(nav);
    const style = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
      if (el instanceof Element && el.classList.contains('alumno-nav')) {
        return { position: 'fixed' } as CSSStyleDeclaration;
      }
      return style(el);
    });
    const rects = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      if (this.classList.contains('alumno-nav')) {
        return DOMRect.fromRect({ x: 0, y: 765, width: 390, height: 79 });
      }
      if (this.classList.contains('alumno-track-card__toggle')) {
        return DOMRect.fromRect({ x: 16, y: 820, width: 358, height: 36 });
      }
      if (this.classList.contains('alumno-btn--lime')) {
        return DOMRect.fromRect({ x: 16, y: 780, width: 358, height: 48 });
      }
      if (this.classList.contains('alumno-pickup')) {
        return DOMRect.fromRect({ x: 16, y: 400, width: 358, height: 150 });
      }
      return DOMRect.fromRect({ x: 0, y: 180, width: 390, height: 680 });
    };

    renderCard(order());
    expect(scrollBy).toHaveBeenCalled();
    expect(scrollBy.mock.calls[0]?.[0]?.top).toBeGreaterThan(40);

    Element.prototype.getBoundingClientRect = rects;
    nav.remove();
  });

  it('en listo muestra QR si el token quedó persistido', async () => {
    rememberPickupQrToken('ord-1', 'pickup-secret');
    renderCard(order({ qr_token: undefined }));
    expect(await screen.findByRole('img', { name: /código qr del pedido/i })).toHaveAttribute(
      'src',
      'data:image/png;base64,qr',
    );
  });
});
