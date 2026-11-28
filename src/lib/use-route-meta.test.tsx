import { beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useNotFoundMeta, useRouteMeta } from './use-route-meta';

function NotFoundProbe({ to }: { to?: string }) {
  useNotFoundMeta();
  const navigate = useNavigate();
  useEffect(() => {
    if (to) void navigate(to);
  }, [navigate, to]);
  return null;
}

function App({ to }: { to?: string }) {
  useRouteMeta();
  return (
    <Routes>
      <Route path="/pedir" element={null} />
      <Route path="*" element={<NotFoundProbe to={to} />} />
    </Routes>
  );
}

function Probe({ to }: { to?: string }) {
  useRouteMeta();
  const navigate = useNavigate();
  useEffect(() => {
    if (to) void navigate(to);
  }, [navigate, to]);
  return null;
}

const content = (selector: string) => document.head.querySelector(selector)?.getAttribute('content');

describe('useRouteMeta', () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="robots" content="noindex, nofollow" />';
    document.title = '';
  });

  it('pone título, descripción, canonical y og de la ruta', () => {
    render(
      <MemoryRouter initialEntries={['/soporte']}>
        <Probe />
      </MemoryRouter>,
    );

    expect(document.title).toBe('Soporte - Vaiinilla');
    expect(content('meta[name="description"]')).toMatch(/equipo@vaiinilla\.app/);
    expect(content('meta[property="og:url"]')).toBe('https://vaiinilla.app/soporte');
    expect(content('meta[name="twitter:title"]')).toBe('Soporte - Vaiinilla');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://vaiinilla.app/soporte',
    );
  });

  it('marca noindex las rutas privadas y lo quita al salir sin tocar el del build', () => {
    render(
      <MemoryRouter initialEntries={['/cuenta/pedidos']}>
        <Probe />
      </MemoryRouter>,
    );
    expect(document.head.querySelectorAll('meta[name="robots"][data-route]')).toHaveLength(1);

    render(
      <MemoryRouter initialEntries={['/cuenta/pedidos']}>
        <Probe to="/pedir" />
      </MemoryRouter>,
    );
    expect(document.head.querySelector('meta[name="robots"][data-route]')).toBeNull();
    expect(document.head.querySelectorAll('meta[name="robots"]')).toHaveLength(1);
  });

  it('la página 404 de la app lleva su título y noindex, sin canonical, y al salir vuelven los de la ruta', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/cookies']}>
        <App />
      </MemoryRouter>,
    );
    expect(document.title).toBe('Página no encontrada - Vaiinilla');
    expect(content('meta[name="description"]')).toMatch(/no existe en vaiinilla\.app/);
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.head.querySelector('meta[property="og:url"]')).toBeNull();
    expect(document.head.querySelectorAll('meta[name="robots"][data-route]')).toHaveLength(1);
    unmount();

    render(
      <MemoryRouter initialEntries={['/cookies']}>
        <App to="/pedir" />
      </MemoryRouter>,
    );
    expect(document.title).toBe('Pedir y recoger sin filas - Vaiinilla');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://vaiinilla.app/pedir');
    expect(document.head.querySelector('meta[name="robots"][data-route]')).toBeNull();
    expect(document.head.querySelectorAll('meta[name="robots"]')).toHaveLength(1);
  });
});
