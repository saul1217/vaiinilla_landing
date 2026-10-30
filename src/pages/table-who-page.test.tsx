import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VaiinillaApiError } from '../lib/api-error';
import type { SharedTable, TableSession } from '../types/api';
import { TableWhoPage } from './table-who-page';

const authState: { user: null | { email: string } } = { user: null };

const { currentTable, tableSession, joinTable, getEstablishment, getLegalVersions, createGuest, renewGuest, openClientSession } =
  vi.hoisted(() => ({
    currentTable: vi.fn(),
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
    currentTable: (...args: unknown[]) => currentTable(...args) as Promise<unknown>,
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
  afterEach(() => vi.useRealTimers());
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    authState.user = null;
    currentTable.mockReset().mockResolvedValue(joined());
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

  it('renders the participant list when currentTable rejects', async () => {
    currentTable.mockRejectedValue(new Error('offline'));
    tableSession.mockResolvedValue(session());
    renderWho();
    expect(await screen.findByRole('button', { name: 'David' })).toBeInTheDocument();
    expect(tableSession).toHaveBeenCalledWith('client-jwt', 'qr-1');
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

  it('deshabilita participantes sin id o en uso y permite el contrato anterior', async () => {
    tableSession.mockResolvedValue(session({ participantes: [
      { alias: 'Ocupado', soy_yo: false, en_uso: true },
      { alias: 'Sin id', soy_yo: false },
      { id: 'busy', alias: 'Con id', soy_yo: false, en_uso: true },
      { id: 'free', alias: 'Libre', soy_yo: false, en_uso: false },
      { id: 'old', alias: 'Anterior', soy_yo: false },
    ] }));
    renderWho();
    await screen.findByRole('button', { name: 'Anterior' });
    for (const name of ['Ocupado', 'Sin id', 'Con id']) {
      const button = screen.getByRole('button', { name: `${name} · En uso en otro teléfono` });
      expect(button).toBeEnabled();
      expect(button).toHaveAttribute('aria-disabled', 'true');
      button.focus();
      expect(button).toHaveFocus();
      fireEvent.click(button);
    }
    expect(screen.getByText('Los nombres marcados como en uso están abiertos en otro teléfono. Únete con otro nombre.')).toBeInTheDocument();
    expect(joinTable).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Libre' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled();
  });

  it('409 PARTICIPANT_TAKEN muestra el mensaje y recarga la lista', async () => {
    tableSession.mockResolvedValueOnce(session()).mockResolvedValueOnce(session({ participantes: [
      { alias: 'David', soy_yo: false, en_uso: true },
    ] }));
    joinTable.mockRejectedValue(new VaiinillaApiError(409, { code: 'PARTICIPANT_TAKEN', message: 'taken' }));
    const user = userEvent.setup();
    renderWho();
    await user.click(await screen.findByRole('button', { name: 'David' }));
    expect(await screen.findByText('Este nombre ya se está usando en otro teléfono. Únete con otro nombre.')).toBeInTheDocument();
    expect(tableSession).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'David · En uso en otro teléfono' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('alert')).toHaveFocus();
    expect(joinTable).toHaveBeenCalledTimes(1);
  });

  it.each([2, undefined])('503 RETRY espera Retry-After (%s) y reintenta una vez', async (retryAfter) => {
    tableSession.mockResolvedValue(session());
    joinTable.mockRejectedValueOnce(new VaiinillaApiError(503, { code: 'RETRY', message: 'retry' }, retryAfter))
      .mockResolvedValueOnce(joined());
    renderWho();
    const button = await screen.findByRole('button', { name: 'David' });
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });
    expect(button).toBeDisabled();
    const delay = (retryAfter ?? 1) * 1000;
    await act(async () => vi.advanceTimersByTimeAsync(delay - 1));
    expect(joinTable).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(joinTable).toHaveBeenCalledTimes(2);
    expect(joinTable).toHaveBeenLastCalledWith('client-jwt', 'qr-1', { participanteId: 'p-david' });
    expect(screen.getByText('Menú demo-a')).toBeInTheDocument();
  });

  it('si el reintento falla muestra un mensaje genérico sin volver a reintentar', async () => {
    tableSession.mockResolvedValue(session());
    joinTable.mockRejectedValue(new VaiinillaApiError(503, { code: 'RETRY', message: 'technical' }));
    renderWho();
    const button = await screen.findByRole('button', { name: 'David' });
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(screen.getByText('No pudimos unirte a la mesa. Inténtalo de nuevo en unos segundos.')).toBeInTheDocument();
    expect(button).toBeEnabled();
    await act(async () => vi.advanceTimersByTimeAsync(10000));
    expect(joinTable).toHaveBeenCalledTimes(2);
  });

  it.each(['PARTICIPANT_NAME_TAKEN', 'PARTICIPANT_TAKEN'])('503 seguido de 409 %s conserva el conflicto', async (code) => {
    tableSession.mockResolvedValue(session());
    const message = code === 'PARTICIPANT_TAKEN'
      ? 'Este nombre ya se está usando en otro teléfono. Únete con otro nombre.'
      : 'Agrega tu apellido para distinguir tu nombre.';
    joinTable.mockRejectedValueOnce(new VaiinillaApiError(503, { code: 'RETRY', message: 'retry' }))
      .mockRejectedValueOnce(new VaiinillaApiError(409, { code, message }));
    renderWho();
    fireEvent.click(await screen.findByRole('button', { name: /agregarme a la mesa/i }));
    fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: 'David' } });
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
      await Promise.resolve();
    });
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(joinTable).toHaveBeenCalledTimes(2);
    if (code === 'PARTICIPANT_TAKEN') {
      expect(tableSession).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('alert')).toHaveFocus();
    } else {
      expect(screen.getByLabelText('Tu nombre')).toHaveValue('David');
    }
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
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
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

  it.each([null, joined({ sesion_id: 'otra' })])('descarta la identidad si /mesas/actual devuelve %j', async (table) => {
    localStorage.setItem('vaiinilla.buyer.table-participant.v1', JSON.stringify({
      slug: 'demo-a', espacioId: 5, sesionId: 'ses-5', participanteId: 'p-david', alias: 'David',
    }));
    currentTable.mockResolvedValue(table);
    tableSession.mockResolvedValue(session());
    renderWho();
    expect(await screen.findByRole('button', { name: 'David' })).toBeInTheDocument();
    expect(currentTable).toHaveBeenCalledWith('client-jwt');
    expect(localStorage.getItem('vaiinilla.buyer.table-participant.v1')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continuar como David' })).not.toBeInTheDocument();
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
    expect(currentTable).toHaveBeenCalledWith('reg-jwt');
    expect(createGuest).not.toHaveBeenCalled();
    authState.user = null;
  });
});
