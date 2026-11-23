import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import type { OrderDetail } from '../types/api';
import { MyCodeSection } from './my-code-section';

const order = (folio: number, estado: string) =>
  ({ id: `o${folio}`, folio, estado, metodo_pago: 'efectivo', destino: 'para_llevar', espacio: null, items: [], pago: null,
    fecha_operativa: '2026-11-20', codigo_recoger: '0133' }) as unknown as OrderDetail;

it('pone primero lo listo y lleva al menú para volver a escanear', () => {
  render(
    <MemoryRouter>
      <MyCodeSection orders={[order(7, 'preparando'), order(8, 'listo')]} slug="escuela" now={new Date(2026, 10, 20, 9)} />
    </MemoryRouter>,
  );
  const items = within(screen.getByRole('list')).getAllByRole('listitem');
  expect(items[0]).toHaveTextContent('#8');
  expect(items[1]).toHaveTextContent('#7');
  expect(screen.getByRole('link', { name: 'vuelve al menú' })).toHaveAttribute('href', '/e/escuela');
});

it('sin pedidos de hoy lo dice', () => {
  render(<MemoryRouter><MyCodeSection orders={[]} slug={null} now={new Date(2026, 10, 20)} /></MemoryRouter>);
  expect(screen.getByText(/Hoy no tienes pedidos/)).toBeInTheDocument();
});
