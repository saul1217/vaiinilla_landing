import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VaiinillaApiError } from '../lib/api-error';
import type { SharedTable, TableSession } from '../types/api';
import { TableWhoPage } from './table-who-page';

const authState: { user: null | { email: string } } = { user: null };

const { tableSession, joinTable, getEstablishment, getLegalVersions, createGuest, renewGuest, openClientSession } =
  vi.hoisted(() => ({
    tableSession: vi.fn(),
    joinTable: vi.fn(),
    getEstablishment: vi.fn(),
    getLegalVersions: vi.fn(),
    createGuest: vi.fn(),
    renewGuest: vi.fn(),
    openClientSession: vi.fn(),
  }));

vi.mock('../lib/api', () => ({
  api: {
    tableSession: (...args: unknown[]) => tableSession(...args) as Promise<unknown>,
    joinTable: (...args: unknown[]) => joinTable(...args) as Promise<unknown>,
    getEstablishment: (...args: unknown[]) => getEstablishment(...args) as Promise<unknown>,
    getLegalVersions: (...args: unknown[]) => getLegalVersions(...args) as Promise<unknown>,
    createGuest: (...args: unknown[]) => createGuest(...args) as Promise<unknown>,
    renewGuest: (...args: unknown[]) => renewGuest(...args) as Promise<unknown>,
    apiUrl: '/api/v1',
  },
}));

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: authState.user, ready: true, configured: false, signOut: vi.fn() }),
}));

vi.mock('../context/buyer-session', () => ({
  useBuyerSessionToken: () => null,
  useBuyerSession: () => ({
    context: null,
    opening: false,
    openClientSession: (...args: unknown[]) => openClientSession(...args) as Promise<unknown>,
    clearSession: vi.fn(),
  }),
}));

function session(over: Partial<TableSession> = {}): TableSession {
  return {
    espacio: { id: 5, nombre: 'Mesa 5', tipo: 'mesa' },
    sesion_id: 'ses-5',
    participantes: [
      { id: 'p-jesus', alias: 'Jesús', soy_yo: false },
      { id: 'p-david', alias: 'David', soy_yo: false },
    ],
    yo: null,
    ...over,
  };
}

function joined(over: Partial<SharedTable> = {}): SharedTable {
  return {
    espacio: { id: 5, nombre: 'Mesa 5', tipo: 'mesa' },
    sesion_id: 'ses-5',
    mi_alias: 'Kikin',
    mi_participante: { id: 'p-kikin', alias: 'Kikin' },
    cuenta_abierta: true,
    participantes: [{ id: 'p-kikin', alias: 'Kikin', soy_yo: true, unido_en: null }],
    grupos: [],
    totales: { total: '0.00', pagado: '0.00', pendiente: '0.00' },
    mi_parte: { total: '0.00', pagado: '0.00', pendiente: '0.00' },
    ...over,
  };
}

function renderWho(entry = '/e/demo-a/m/qr-1/quien?next=/e/demo-a') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/e/:slug/m/:token/quien" element={<TableWhoPage />} />
        <Route path="/e/:slug" element={<p>Menú demo-a</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TableWhoPage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    authState.user = null;
    tableSession.mockReset();
    joinTable.mockReset();
    getEstablishment.mockReset();
    openClientSession.mockReset();
    createGuest.mockReset();
    renewGuest.mockReset();
    getLegalVersions.mockReset();
    getLegalVersions.mockResolvedValue({
      terminos_version: 't-1',
      terminos_url: '/terminos',
      privacidad_version: 'p-1',
      privacidad_url: '/privacidad',
    });
    createGuest.mockResolvedValue({
      access_token: 'client-jwt',
      expires_in: 900,
      contexto: { establecimiento_id: 'e1' },
      invitado: { nombre: '', llave: 'L'.repeat(43) },
    });
    renewGuest.mockRejectedValue(new Error('sin llave'));
  });

  it('lista los participantes para elegir quién se es', async () => {
    tableSession.mockResolvedValue(session());
    renderWho();
    expect(await screen.findByRole('heading', { name: /quién eres/i })).toBeInTheDocument();
    expect(screen.getByText('Selecciona tu nombre para continuar.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jesús' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'David' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregarme a la mesa/i })).toBeInTheDocument();
  });

  it('con yo ofrece continuar y "No soy" muestra la lista', async () => {
    tableSession.mockResolvedValue(session({ yo: { id: 'p-jesus', alias: 'Jesús' } }));
    const user = userEvent.setup();
    renderWho();
    expect(await screen.findByRole('heading', { name: /continuar como jesús/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar como Jesús' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /no soy jesús/i }));
    expect(screen.getByRole('heading', { name: /quién eres/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'David' })).toBeInTheDocument();
  });

  it('continuar como yo llama a unirse con su participanteId', async () => {
    tableSession.mockResolvedValue(session({ yo: { id: 'p-jesus', alias: 'Jesús' } }));
    joinTable.mockResolvedValue(joined({ mi_participante: { id: 'p-jesus', alias: 'Jesús' }, mi_alias: 'Jesús' }));
    const user = userEvent.setup();
    renderWho();
    await user.click(await screen.findByRole('button', { name: 'Continuar como Jesús' }));
    expect(joinTable).toHaveBeenCalledWith('client-jwt', 'qr-1', { participanteId: 'p-jesus' });
    expect(await screen.findByText('Menú demo-a')).toBeInTheDocument();
  });

  it('elegir un nombre existente llama a unirse con su participanteId', async () => {
    tableSession.mockResolvedValue(session());
    joinTable.mockResolvedValue(joined({ mi_participante: { id: 'p-david', alias: 'David' }, mi_alias: 'David' }));
    const user = userEvent.setup();
    renderWho();
    await user.click(await screen.findByRole('button', { name: 'David' }));
    expect(joinTable).toHaveBeenCalledWith('client-jwt', 'qr-1', { participanteId: 'p-david' });
    expect(await screen.findByText('Menú demo-a')).toBeInTheDocument();
  });

  it('agregarme crea el participante con su alias y lo guarda', async () => {
    tableSession.mockResolvedValue(session());
    joinTable.mockResolvedValue(joined());
    const user = userEvent.setup();
    renderWho();
    await user.click(await screen.findByRole('button', { name: /agregarme a la mesa/i }));
    await user.type(screen.getByLabelText('Tu nombre'), 'Kikin');
    await user.click(screen.getByRole('button', { name: /^entrar$/i }));
    expect(joinTable).toHaveBeenCalledWith('client-jwt', 'qr-1', { alias: 'Kikin' });
    expect(await screen.findByText('Menú demo-a')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('vaiinilla.buyer.table-participant.v1') ?? 'null')).toMatchObject({
      slug: 'demo-a',
      espacioId: 5,
      sesionId: 'ses-5',
      participanteId: 'p-kikin',
      alias: 'Kikin',
    });
  });

  it('nombre repetido (409): muestra el mensaje del servidor y deja el texto', async () => {
    tableSession.mockResolvedValue(session());
    const message =
      'Ya hay una persona llamada David en esta mesa. Agrega tu apellido o utiliza otro nombre para poder distinguir sus pedidos.';
    joinTable.mockRejectedValue(
      new VaiinillaApiError(409, { code: 'PARTICIPANT_NAME_TAKEN', message }),
    );
    const user = userEvent.setup();
    renderWho();
    await user.click(await screen.findByRole('button', { name: /agregarme a la mesa/i }));
    await user.type(screen.getByLabelText('Tu nombre'), 'David');
    await user.click(screen.getByRole('button', { name: /^entrar$/i }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    // El texto sigue para agregar el apellido.
    expect(screen.getByLabelText('Tu nombre')).toHaveValue('David');
    expect(screen.getByText(/david r\. o david ramírez/i)).toBeInTheDocument();
    // Sigue en la pantalla, no avanzó al menú.
    expect(screen.queryByText('Menú demo-a')).not.toBeInTheDocument();
  });

  it('restaura la identidad local cuando el servidor aún no me reconoce', async () => {
    localStorage.setItem(
      'vaiinilla.buyer.table-participant.v1',
      JSON.stringify({ slug: 'demo-a', espacioId: 5, sesionId: 'ses-5', participanteId: 'p-david', alias: 'David' }),
    );
    tableSession.mockResolvedValue(session());
    renderWho();
    expect(await screen.findByRole('heading', { name: /continuar como david/i })).toBeInTheDocument();
  });

  it('si la sesión cambió, la identidad local se borra y se muestra la lista', async () => {
    localStorage.setItem(
      'vaiinilla.buyer.table-participant.v1',
      JSON.stringify({ slug: 'demo-a', espacioId: 5, sesionId: 'ses-vieja', participanteId: 'p-x', alias: 'X' }),
    );
    tableSession.mockResolvedValue(session());
    renderWho();
    expect(await screen.findByRole('heading', { name: /quién eres/i })).toBeInTheDocument();
    expect(localStorage.getItem('vaiinilla.buyer.table-participant.v1')).toBeNull();
  });

  it('mesa vacía: solo ofrece agregarme', async () => {
    tableSession.mockResolvedValue(session({ participantes: [] }));
    renderWho();
    expect(await screen.findByRole('heading', { name: /quién eres/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /agregarme a la mesa/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Tu nombre')).toBeInTheDocument();
  });

  it('error de red con reintentar', async () => {
    tableSession.mockRejectedValueOnce(new Error('Error de red'));
    tableSession.mockResolvedValueOnce(session());
    const user = userEvent.setup();
    renderWho();
    expect(await screen.findByText('Error de red')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(await screen.findByRole('heading', { name: /quién eres/i })).toBeInTheDocument();
    expect(tableSession).toHaveBeenCalledTimes(2);
  });

  it('registrado usa su sesión de cliente, no invitado anónimo', async () => {
    authState.user = { email: 'ana@example.test' };
    getEstablishment.mockResolvedValue({ id: 'e1', nombre: 'Demo', slug: 'demo-a' });
    openClientSession.mockResolvedValue({ access_token: 'reg-jwt', contexto: { establecimiento_id: 'e1' } });
    tableSession.mockResolvedValue(session());
    renderWho();
    expect(await screen.findByRole('heading', { name: /quién eres/i })).toBeInTheDocument();
    await waitFor(() => expect(tableSession).toHaveBeenCalledWith('reg-jwt', 'qr-1'));
    expect(createGuest).not.toHaveBeenCalled();
    authState.user = null;
  });
});
