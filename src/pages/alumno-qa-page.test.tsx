import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/theme-context';
import { QA_PHOTO_POZOLE, QA_PHOTO_TACOS } from '../lib/qa-catalog-photos';
import {
  AlumnoQaCartPage,
  AlumnoQaFilledCartPage,
  AlumnoQaOrderDetailPage,
  AlumnoQaOrdersPage,
} from './alumno-qa-page';

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,qr') },
}));

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({
    user: null,
    ready: true,
    configured: true,
    signOut: vi.fn(),
  }),
}));

vi.mock('../context/cart-context', () => ({
  useCart: () => ({
    cart: {
      slug: 'demo-a',
      establishmentName: 'Demo A',
      lines: [
        { productId: 2, quantity: 2, optionIds: [], productName: 'fruti Lupis', unitPreview: '22.00' },
      ],
    },
  }),
}));

describe('AlumnoQaCartPage', () => {
  it('deja pedidos anteriores solo texto y usa fotos reales en peek', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AlumnoQaCartPage />
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(document.querySelectorAll('.alumno-history-row img')).toHaveLength(0);
    expect(document.querySelector('.alumno-antojo__hug')).toHaveAttribute('src', '/vaini/cutout-hug-question.png');
    expect(document.querySelector('.alumno-antojo__q-face')).toBeNull();
    expect(document.querySelector('.alumno-antojo__vaini')).toBeNull();
    expect(screen.getByText('1× fruti Lupis')).toBeInTheDocument();
    expect(screen.getByText('#76 · Entregado')).toBeInTheDocument();
    expect(screen.getByText('1× Quiere keke')).toBeInTheDocument();
    expect(screen.getByText('#68 · Entregado')).toBeInTheDocument();
    const peekThumbs = [...document.querySelectorAll('.alumno-cart-peek__row > img')];
    expect(peekThumbs.map((node) => node.getAttribute('src'))).toEqual([
      QA_PHOTO_POZOLE,
      QA_PHOTO_TACOS,
    ]);
  });
});

describe('AlumnoQaFilledCartPage', () => {
  it('muestra líneas oscuras con fotos reales del catálogo y montos Android', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AlumnoQaFilledCartPage />
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Tu pedido' })).toBeInTheDocument();
    expect(screen.getAllByText('fruti Lupis').length).toBeGreaterThan(0);
    expect(screen.getByText('$22 c/u')).toBeInTheDocument();
    expect(screen.getByText('$44')).toBeInTheDocument();
    expect(screen.getAllByText('Quiere keke').length).toBeGreaterThan(0);
    expect(screen.getByText('$73.70 c/u')).toBeInTheDocument();
    expect(screen.getByText('Total $117.70')).toBeInTheDocument();
    expect(document.querySelector('.alumno-cart-layout__pay .alumno-cart-layout__total')).toHaveTextContent(
      'Total $117.70',
    );
    expect(document.querySelector('.alumno-cart-layout__pay .alumno-sticky-pay')).toBeTruthy();
    expect(document.querySelectorAll('.alumno-line')).toHaveLength(2);
    const lineThumbs = [...document.querySelectorAll('.alumno-line__thumb:not(.alumno-line__thumb--vaini)')];
    expect(lineThumbs.map((node) => node.getAttribute('src'))).toEqual([QA_PHOTO_POZOLE, QA_PHOTO_TACOS]);
    expect(document.querySelectorAll('.alumno-line__thumb--vaini')).toHaveLength(0);
    expect(screen.getByRole('button', { name: /^pagar$/i })).toBeEnabled();
    expect(screen.getByRole('heading', { name: /del menú/i })).toBeInTheDocument();
  });
});

describe('AlumnoQaOrdersPage', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
      }),
    });
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('resuelve thumbs de Venecia por catálogo cuando el fixture no trae foto', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AlumnoQaOrdersPage />
        </ThemeProvider>
      </MemoryRouter>,
    );

    const thumbs = [...document.querySelectorAll('img.alumno-track-card__thumb')];
    expect(thumbs.length).toBeGreaterThan(0);
    expect(thumbs.every((node) => node.getAttribute('src') === QA_PHOTO_TACOS)).toBe(true);
    expect(document.querySelectorAll('.alumno-track-card__thumb--vaini')).toHaveLength(0);
  });

  it('abre COBRADO #94 contra Android y deja LISTO como segunda card', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AlumnoQaOrdersPage />
        </ThemeProvider>
      </MemoryRouter>,
    );

    const listCards = [...document.querySelectorAll('.alumno-orders-desk__list .alumno-track-card')];
    expect(listCards.map((card) => card.querySelector('.alumno-track-card__pill')?.textContent)).toEqual([
      'Por cobrar',
      'Cobrado',
      'Listo',
    ]);
    const open = document.querySelector('.alumno-orders-desk__list .alumno-track-card.is-open');
    expect(open?.querySelector('.alumno-track-card__folio')).toHaveTextContent('#94');
    expect(open?.querySelector('.alumno-track-card__pill')).toHaveTextContent('Cobrado');
    expect(open?.querySelector('.alumno-pickup')).toBeNull();
    expect(open?.querySelector('.alumno-track-card__status')).toHaveTextContent(
      /Cobrado\s+Cocina recibió la comanda/i,
    );
    const steps = [...(open?.querySelectorAll('.alumno-timeline li') ?? [])];
    expect(steps.map((step) => step.querySelector('strong')?.textContent)).toEqual([
      'Pago confirmado',
      'Cobrado',
      'Preparando',
      'Listo',
      'Entregado',
    ]);
    expect(steps[0]).toHaveClass('is-done');
    expect(steps[1]).toHaveClass('is-current');
    expect(steps[1]?.querySelector('.alumno-timeline__mark')?.textContent).toBe('2');
    expect(steps.slice(2).every((step) => step.classList.contains('is-todo'))).toBe(true);
    expect(steps.slice(2).map((step) => step.querySelector('.alumno-timeline__mark')?.textContent)).toEqual([
      '3',
      '4',
      '5',
    ]);
    expect(open?.querySelector('.alumno-timeline li:nth-child(4)')).toHaveTextContent(/recógelo en la barra/i);
    expect(open?.querySelector('.alumno-pickup')).toBeNull();
    expect(screen.queryByRole('img', { name: /código qr/i })).not.toBeInTheDocument();
    expect((open?.textContent?.match(/Recógelo en la barra/gi) ?? []).length).toBe(1);

    const siblingAbove = listCards[0];
    expect(siblingAbove).not.toHaveClass('is-compact');
    expect(siblingAbove).not.toHaveClass('is-open');
    expect(siblingAbove?.querySelector('.alumno-track-card__folio')).toHaveTextContent('#95');
    expect(siblingAbove?.querySelector('.alumno-track-bar')).toBeTruthy();
    expect(siblingAbove?.querySelector('.alumno-track-card__status')).toHaveTextContent(/por cobrar/i);
    expect(siblingAbove?.querySelector('.alumno-track-card__toggle')).toHaveTextContent(/ver seguimiento/i);

    const listoRow = listCards[2];
    expect(listoRow?.querySelector('.alumno-track-card__folio')).toHaveTextContent('#93');
    await user.click(listoRow!.querySelector('.alumno-track-card__folio')!);
    const listo = document.querySelector('.alumno-orders-desk__list .alumno-track-card.is-open');
    expect(listo?.querySelector('.alumno-track-card__pill')).toHaveTextContent('Listo');
    expect(listo?.querySelector('.alumno-pickup')).toHaveTextContent(/recógelo en la barra/i);
    expect(listo?.querySelector('.alumno-timeline li.is-current .alumno-timeline__mark')?.textContent).toBe('4');
  });

  it('en split 1280 Recógelo de LISTO #93 vive solo en el detalle', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query.includes('1024'),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
      }),
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AlumnoQaOrdersPage />
        </ThemeProvider>
      </MemoryRouter>,
    );

    const listCards = [...document.querySelectorAll('.alumno-orders-desk__list .alumno-track-card')];
    expect(document.querySelector('.alumno-orders-desk__list .alumno-track-card.is-open')).toBeNull();
    const selected = document.querySelector('.alumno-orders-desk__list .alumno-track-card.is-selected');
    expect(selected?.querySelector('.alumno-track-card__folio')).toHaveTextContent('#94');
    expect(selected?.querySelector('.alumno-track-card__pill')).toHaveTextContent('Cobrado');
    expect(selected?.querySelector('.alumno-pickup')).toBeNull();
    expect(selected?.querySelector('.alumno-track-card__status')).toHaveTextContent(
      /Cobrado\s+Cocina recibió la comanda/i,
    );

    const detail = document.querySelector('.alumno-orders-desk__detail .alumno-track-card');
    expect(detail?.querySelector('.alumno-track-card__folio')).toHaveTextContent('#94');
    expect(detail?.querySelector('.alumno-pickup')).toBeNull();
    expect((document.body.textContent?.match(/Recógelo en la barra/gi) ?? []).length).toBe(1);

    const listoRow = listCards[2];
    expect(listoRow?.querySelector('.alumno-track-card__folio')).toHaveTextContent('#93');
    expect(listoRow?.querySelector('.alumno-track-card__status')).toHaveTextContent(/^Listo$/);
    await user.click(listoRow!.querySelector('.alumno-track-card__folio')!);

    const selectedListo = document.querySelector('.alumno-orders-desk__list .alumno-track-card.is-selected');
    expect(selectedListo?.querySelector('.alumno-track-card__folio')).toHaveTextContent('#93');
    expect(selectedListo).toHaveAttribute('aria-current', 'true');
    expect(selectedListo?.querySelector('.alumno-track-card__status')).toHaveTextContent(/^Listo$/);
    expect(selectedListo?.querySelector('.alumno-pickup')).toBeNull();
    expect(document.querySelector('.alumno-orders-desk__list .alumno-pickup')).toBeNull();

    const detailListo = document.querySelector('.alumno-orders-desk__detail .alumno-track-card');
    expect(detailListo?.querySelector('.alumno-track-card__folio')).toHaveTextContent('#93');
    expect(detailListo?.querySelector('.alumno-pickup')).toHaveTextContent(/recógelo en la barra/i);
    expect(detailListo?.querySelector('.alumno-pickup__folio')).toHaveTextContent('#93');
    expect(detailListo?.querySelector('.alumno-timeline li.is-current .alumno-timeline__mark')?.textContent).toBe(
      '4',
    );
    expect(await screen.findByRole('img', { name: /código qr/i })).toBeInTheDocument();
    expect(document.querySelectorAll('.alumno-pickup')).toHaveLength(1);
    expect((document.body.textContent?.match(/Recógelo en la barra/gi) ?? []).length).toBe(1);

    const hide = screen.getByRole('button', { name: /^ocultar$/i });
    expect(hide.compareDocumentPosition(detailListo!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(hide);
    expect(document.querySelector('.alumno-orders-desk__list .alumno-track-card.is-selected')).toBeNull();
    expect(document.querySelector('.alumno-orders-desk__detail .alumno-track-card')).toBeNull();
    expect(screen.getByText(/elige un pedido para ver el seguimiento/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^ocultar$/i })).not.toBeInTheDocument();
  });
});

describe('AlumnoQaOrderDetailPage', () => {
  it('usa la foto live de Venecia en la card de seguimiento', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AlumnoQaOrderDetailPage />
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(document.querySelector('img.alumno-track-card__thumb')).toHaveAttribute('src', QA_PHOTO_TACOS);
    expect(document.querySelectorAll('.alumno-track-card__thumb--vaini')).toHaveLength(0);
    expect(screen.queryByText(/MXN/)).not.toBeInTheDocument();
  });
});
