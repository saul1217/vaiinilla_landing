import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from './router';

vi.mock('../pages/orders-page', () => ({ OrdersPage: () => <p>Mis pedidos</p> }));

describe('/cuenta/reservas', () => {
  it('redirige al instante a Mis pedidos en vez de mostrar un 404', () => {
    render(
      <MemoryRouter initialEntries={['/cuenta/reservas']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getByText('Mis pedidos')).toBeTruthy();
  });
});
