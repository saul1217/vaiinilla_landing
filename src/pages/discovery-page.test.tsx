import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscoveryPage } from './discovery-page';
import { TableCodeSheet } from '../components/table-code-sheet';

const listEstablishments = vi.fn();
const resolveSpace = vi.fn();

vi.mock('../lib/api', () => ({
  api: {
    listEstablishments: (...args: unknown[]) => listEstablishments(...args) as Promise<unknown>,
    resolveSpace: (...args: unknown[]) => resolveSpace(...args) as Promise<unknown>,
    getLegalVersions: vi.fn().mockResolvedValue({
      terminos_version: '2026-07',
      privacidad_version: '2026-07',
      terminos_url: 'https://example.test/terminos',
      privacidad_url: 'https://example.test/privacidad',
    }),
  },
}));

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: null, ready: true, configured: false, signOut: vi.fn() }),
}));

vi.mock('../context/cart-context', () => ({
  useCart: () => ({ cart: null }),
}));

describe('DiscoveryPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('vaiinilla.buyer.guest-explore.v1', '1');
    listEstablishments.mockResolvedValue({
      establishments: [
        {
          id: '1',
          nombre: 'Cafetería Demo A',
          slug: 'demo-a',
          identificador_cliente_etiqueta: 'Matrícula',
          identificador_cliente_obligatorio: true,
          instagram_url: 'https://instagram.com/cafeteria-demo',
        },
      ],
      cursor: null,
    });
  });

  it('lista establecimientos públicos y deja continuar al menú', async () => {
    render(
      <MemoryRouter>
        <DiscoveryPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: /en qué restaurante estás/i })).toBeInTheDocument();
    expect(screen.getByText(/la ubicación es opcional/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /escribir número de mesa/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /más opciones/i })).toBeInTheDocument();
    expect(await screen.findByRole('radio', { name: /cafetería demo a/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entrar al menú/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir Instagram' })).toHaveAttribute('href', 'https://instagram.com/cafeteria-demo');
    await userEvent.setup().click(screen.getByRole('button', { name: /entrar al menú/i }));
    expect(await screen.findByRole('heading', { name: /cafetería demo a/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /usar código/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /abrir menú/i })).toBeInTheDocument();
  });

  it('muestra los videos del local como enlaces que abren en otra pestaña', async () => {
    listEstablishments.mockResolvedValue({
      establishments: [
        {
          id: '1',
          nombre: 'Cafetería Demo A',
          slug: 'demo-a',
          identificador_cliente_etiqueta: 'Matrícula',
          identificador_cliente_obligatorio: true,
          videos_local: [{ titulo: 'Así preparamos el café', url: 'https://www.youtube.com/watch?v=abc' }],
        },
      ],
      cursor: null,
    });
    render(
      <MemoryRouter>
        <DiscoveryPage />
      </MemoryRouter>,
    );
    const video = await screen.findByRole('link', { name: 'Así preparamos el café' });
    expect(video).toHaveAttribute('href', 'https://www.youtube.com/watch?v=abc');
    expect(video).toHaveAttribute('target', '_blank');
    expect(video).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('abre el picker de establecimientos sin pedir splash ni cuenta', async () => {
    sessionStorage.clear();
    render(
      <MemoryRouter>
        <DiscoveryPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: /en qué restaurante estás/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /tu lugar, a tu ritmo/i })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /^navegación$/i })).toBeInTheDocument();
  });

  it.each([
    ['qr', /escanea el qr/i],
    ['codigo', /ingresa el código de mesa/i],
    ['nfc', /acerca tu teléfono/i],
  ] as const)('?entrada=%s abre la hoja correcta en PlaceEntry', async (entrada, heading) => {
    render(
      <MemoryRouter initialEntries={[`/pedir?entrada=${entrada}`]}>
        <DiscoveryPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('?entrada=buscar enfoca el campo #search-places', async () => {
    render(
      <MemoryRouter initialEntries={['/pedir?entrada=buscar']}>
        <DiscoveryPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: /en qué restaurante estás/i })).toBeInTheDocument();
    const search = await screen.findByRole('textbox', { name: /buscar restaurante/i });
    expect(search).toHaveAttribute('id', 'search-places');
    await waitFor(() => expect(search).toHaveFocus());
  });

  it('el código de mesa guarda el token para unirse después', async () => {
    resolveSpace.mockResolvedValue({
      establecimiento_slug: 'demo-a',
      espacio_id: 3,
      espacio_nombre: 'Mesa 3',
      espacio_tipo: 'mesa',
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DiscoveryPage />
      </MemoryRouter>,
    );
    await user.click(await screen.findByRole('radio', { name: /cafetería demo a/i }));
    await user.click(screen.getByRole('button', { name: /entrar al menú/i }));
    await user.click(screen.getByRole('button', { name: /usar código/i }));
    for (const digit of ['1', '2', '3', '4', '5', '6', '7', '8']) {
      await user.click(screen.getByRole('button', { name: digit }));
    }
    await user.click(screen.getByRole('button', { name: /listo/i }));

    await waitFor(() => expect(resolveSpace).toHaveBeenCalledWith('12345678', 'demo-a'));
    const raw = localStorage.getItem('vaiinilla.buyer.space.v1');
    expect(raw).toContain('"qrToken":"12345678"');
    expect(raw).toContain('"espacioId":3');
  });

  it('mantiene cámara y NFC disponibles como opciones secundarias', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><DiscoveryPage /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: /escribir número de mesa/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /usar cámara/i })).not.toBeInTheDocument();
    await user.click(screen.getByText('Más opciones'));
    expect(screen.getByRole('button', { name: /usar cámara/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /acercar el teléfono a la etiqueta/i })).toBeInTheDocument();
  });

  it('explica dónde encontrar el código y solo confirma con cuatro números', () => {
    const onChange = vi.fn();
    const onConfirm = vi.fn();
    const view = render(<TableCodeSheet code="123" resolving={false} error={null} onChange={onChange} onConfirm={onConfirm} onClosed={vi.fn()} />);
    expect(screen.getByText(/4 números que ves en la mesa o en el papel del mesero/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmar y sentarme/i })).toBeDisabled();
    fireEvent.keyDown(document.querySelector('.alumno-codesheet__panel')!, { key: '4' });
    expect(onChange).toHaveBeenCalledWith('1234');
    view.rerender(<TableCodeSheet code="1234" resolving={false} error="No encontramos ese código." onChange={onChange} onConfirm={onConfirm} onClosed={vi.fn()} />);
    expect(screen.getByRole('button', { name: /confirmar y sentarme/i })).toBeEnabled();
    expect(screen.getByText('No encontramos ese código.')).toBeInTheDocument();
  });
});
