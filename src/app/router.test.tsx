import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from './router';

vi.mock('../pages/orders-page', () => ({ OrdersPage: () => <p>Mis pedidos</p> }));
vi.mock('../pages/not-found-page', () => ({ NotFoundPage: () => <p>No encontrada</p> }));
vi.mock('../pages/assistant-page', () => ({ AssistantPage: () => <p>Asistente</p> }));

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

describe('/e/:slug/asistente', () => {
  it('con la bandera apagada (por defecto) la ruta no existe', () => {
    render(
      <MemoryRouter initialEntries={['/e/demo/asistente']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.queryByText('Asistente')).toBeNull();
    expect(screen.getByText('No encontrada')).toBeTruthy();
  });
});
