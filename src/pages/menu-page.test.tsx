import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/theme-context';
import { api } from '../lib/api';
import { QA_PHOTO_TACOS } from '../lib/qa-catalog-photos';
import { MenuPage } from './menu-page';

const addLine = vi.fn();
const authState: { user: { email: string; displayName: string } | null } = { user: null };

vi.mock('../lib/api', () => ({
  api: {
    getEstablishment: vi.fn().mockResolvedValue({
      id: '1',
      nombre: 'Cafetería Demo A',
      slug: 'demo-a',
      identificador_cliente_etiqueta: 'Matrícula',
      identificador_cliente_obligatorio: false,
    }),
    getGuestCatalog: vi.fn().mockResolvedValue({
      categorias: [{ id: 1, nombre: 'Bebidas', orden: 1 }],
      productos: [
        {
          id: 10,
          categoria_id: 1,
          estacion_preparacion: 'caja',
          nombre: 'Chocolate frío',
          descripcion: 'Bebida de cacao',
          ingredientes: null,
          alergenos: null,
          tiempo_estimado_min: 4,
          precio_mostrador: '40.00',
          precio_digital: '38.00',
          disponible: true,
          imagen_url: null,
          grupos_opcion: [],
        },
      ],
    }),
  },
}));

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: authState.user, ready: true, configured: true, signOut: vi.fn() }),
}));

vi.mock('../context/cart-context', () => ({
  useCart: () => ({
    cart: { slug: 'demo-a', establishmentName: 'Demo A', lines: [] },
    addLine,
    updateQuantity: vi.fn(),
    removeLine: vi.fn(),
    reset: vi.fn(),
  }),
}));

function renderMenu() {
  return render(
    <MemoryRouter initialEntries={['/e/demo-a']}>
      <ThemeProvider>
        <Routes>
          <Route path="/e/:slug" element={<MenuPage />} />
          <Route path="/e/:slug/carrito" element={<p>Carrito</p>} />
          <Route path="/cuenta" element={<p>Cuenta login</p>} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('MenuPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    authState.user = null;
    addLine.mockReset();
  });

  it('sin sesión no agrega: pide login o comprar sin cuenta', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(await screen.findByRole('button', { name: /chocolate frío/i }));
    expect(screen.queryByRole('button', { name: /agregar/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /iniciar sesión para comprar/i })).toHaveAttribute(
      'href',
      '/cuenta?next=/e/demo-a',
    );
    expect(screen.getByRole('button', { name: /comprar sin cuenta/i })).toBeInTheDocument();
    expect(document.querySelector('.alumno-psheet__photo')).toBeNull();
    expect(document.querySelector('.alumno-psheet__vaini')).toHaveAttribute('src', '/vaini/cutout-frente.png');
  });

  it('con foto de catálogo abre el rail y conserva un fallback hasta que cargue', async () => {
    vi.mocked(api.getGuestCatalog).mockResolvedValueOnce({
      categorias: [{ id: 1, nombre: 'Platos', orden: 1 }],
      productos: [
        {
          id: 22,
          categoria_id: 1,
          estacion_preparacion: 'cocina',
          nombre: 'Tacos de Cochinita Pibil',
          descripcion: null,
          ingredientes: null,
          alergenos: null,
          tiempo_estimado_min: 8,
          precio_mostrador: '99.00',
          precio_digital: '99.00',
          disponible: true,
          imagen_url: QA_PHOTO_TACOS,
          grupos_opcion: [],
        },
      ],
    });
    const user = userEvent.setup();
    renderMenu();
    await user.click(await screen.findByRole('button', { name: /tacos de cochinita/i }));
    const photo = document.querySelector('.alumno-psheet__photo');
    expect(photo).toHaveAttribute('src', QA_PHOTO_TACOS);
    expect(photo).not.toHaveClass('is-ready');
    expect(document.querySelector('.alumno-psheet__vaini')).toHaveAttribute('src', '/vaini/cutout-frente.png');
    fireEvent.load(photo!);
    expect(photo).toHaveClass('is-ready');
    expect(document.querySelector('.alumno-psheet__vaini')).toBeNull();
  });

  it('comprar sin cuenta mete el producto al carrito', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(await screen.findByRole('button', { name: /chocolate frío/i }));
    await user.click(screen.getByRole('button', { name: /comprar sin cuenta/i }));
    expect(addLine).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('vaiinilla.buyer.guest-buy.v1')).toBe('1');
    expect(await screen.findByText('Carrito')).toBeInTheDocument();
  });
});
