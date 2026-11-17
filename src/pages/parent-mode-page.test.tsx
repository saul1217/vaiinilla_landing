import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/theme-context';
import { VaiinillaApiError } from '../lib/api-error';
import { DependentContextSession, parseChildMenuCalendar, parseDependent, parseDependents } from '../lib/guardianship';
import { AppRoutes } from '../app/router';
import { ChildAccountPage, ParentModePage } from './parent-mode-page';

const authState: { user: { uid: string; email: string; displayName: string } | null } = {
  user: { uid: 'firebase-uid', email: 'laura@example.test', displayName: 'Laura' },
};

const {
  getEstablishment,
  listDependents,
  issueDependentContext,
  getDependentWallet,
  listDependentOrders,
  getGuardianPrivacyNotice,
  acceptGuardianPrivacyNotice,
  openClientSession,
  updateDependent,
  listStudentRequests,
  getOperationalStatus,
  getDependentMenuCalendar,
  reserveDependentWeek,
  cancelDependentOrder,
  createGuardianInviteCode,
} = vi.hoisted(() => ({
  updateDependent: vi.fn(),
  listStudentRequests: vi.fn(),
  getOperationalStatus: vi.fn(),
  getDependentMenuCalendar: vi.fn(),
  reserveDependentWeek: vi.fn(),
  cancelDependentOrder: vi.fn(),
  createGuardianInviteCode: vi.fn(),
  getEstablishment: vi.fn(),
  listDependents: vi.fn(),
  issueDependentContext: vi.fn(),
  getDependentWallet: vi.fn(),
  listDependentOrders: vi.fn(),
  getGuardianPrivacyNotice: vi.fn(),
  acceptGuardianPrivacyNotice: vi.fn(),
  openClientSession: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    getEstablishment: (...args: unknown[]) => getEstablishment(...args) as Promise<unknown>,
    listDependents: (...args: unknown[]) => listDependents(...args) as Promise<unknown>,
    issueDependentContext: (...args: unknown[]) => issueDependentContext(...args) as Promise<unknown>,
    getDependentWallet: (...args: unknown[]) => getDependentWallet(...args) as Promise<unknown>,
    listDependentOrders: (...args: unknown[]) => listDependentOrders(...args) as Promise<unknown>,
    getGuardianPrivacyNotice: (...args: unknown[]) => getGuardianPrivacyNotice(...args) as Promise<unknown>,
    acceptGuardianPrivacyNotice: (...args: unknown[]) => acceptGuardianPrivacyNotice(...args) as Promise<unknown>,
    updateDependent: (...args: unknown[]) => updateDependent(...args) as Promise<unknown>,
    listStudentRequests: (...args: unknown[]) => listStudentRequests(...args) as Promise<unknown>,
    getOperationalStatus: (...args: unknown[]) => getOperationalStatus(...args) as Promise<unknown>,
    getDependentMenuCalendar: (...args: unknown[]) => getDependentMenuCalendar(...args) as Promise<unknown>,
    reserveDependentWeek: (...args: unknown[]) => reserveDependentWeek(...args) as Promise<unknown>,
    cancelDependentOrder: (...args: unknown[]) => cancelDependentOrder(...args) as Promise<unknown>,
    createGuardianInviteCode: (...args: unknown[]) => createGuardianInviteCode(...args) as Promise<unknown>,
    listAccesses: vi.fn().mockResolvedValue([]),
    getGuestCatalog: vi.fn().mockResolvedValue({ categorias: [], productos: [] }),
    currentTable: vi.fn().mockResolvedValue(null),
  },
  onUnauthorizedSession: () => () => undefined,
}));

vi.mock('../lib/firebase', () => ({ firebaseIdToken: vi.fn().mockResolvedValue('firebase-token') }));

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: authState.user, ready: true, configured: true, signOut: vi.fn() }),
}));

vi.mock('../context/cart-context', () => ({
  useCart: () => ({ cart: { slug: 'escuela', establishmentName: 'Escuela', lines: [] } }),
}));

vi.mock('../context/buyer-session', () => ({
  useBuyerSessionToken: () => null,
  useBuyerSession: () => ({
    context: { access_token: 'tutor-jwt', contexto: { establecimiento_id: 'e1' } },
    opening: false,
    openClientSession,
    clearSession: vi.fn(),
  }),
}));

const rawChildren = [
  {
    usuario_id: 'u-tilin',
    nombre: 'Tilin Ramírez',
    grupo: '3B',
    matricula: 'A100',
    estado: 'aprobada',
    requiere_consentimiento: false,
    soy_principal: true,
    tutores: [{ tutela_id: 't1', nombre: 'Laura', principal: true, eres_tu: true }],
    saldo: '120.50',
    controles: {
      limite_diario: '60.00',
      gastado_hoy: '20.00',
      disponible_hoy: '40.00',
      productos_bloqueados: [5],
      categorias_bloqueadas: [],
      alergenos: ['cacahuate'],
    },
  },
  {
    usuario_id: 'u-mia',
    nombre: 'Mía Ramírez',
    grupo: '1A',
    matricula: 'A200',
    estado: 'pendiente',
    requiere_consentimiento: false,
    saldo: null,
    controles: null,
  },
];

const wallet = {
  cliente: { usuario_id: 'u-tilin', nombre: 'Tilin Ramírez', identificador_cliente: 'A100' },
  wallet: { id: 'w1', usuario_id: 'u-tilin', establecimiento_id: 'e1', saldo: '95.50', actualizado_en: null },
  movimientos: [
    {
      id: 'm2',
      tipo: 'compra',
      descripcion: 'Pedido 12',
      monto: '-25.00',
      saldo_posterior: '95.50',
      pedido_id: 'p12',
      creado_en: '2026-11-09T18:00:00Z',
    },
    {
      id: 'm1',
      tipo: 'recarga_efectivo',
      descripcion: '',
      monto: '100.00',
      saldo_posterior: '120.50',
      pedido_id: null,
      creado_en: '2026-11-08T15:00:00Z',
    },
  ],
};

const orders = [
  {
    id: 'p12',
    folio: 12,
    estado: 'entregado',
    total: '25.00',
    creado_en: '2026-11-09T18:00:00Z',
    items: [
      { id: 1, producto_id: 1, nombre_producto: 'Torta', cantidad: 1 },
      { id: 2, producto_id: 2, nombre_producto: 'Agua', cantidad: 2 },
    ],
  },
];

function renderAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ThemeProvider>
        <Routes>
          <Route path="/cuenta/hijos" element={<ParentModePage />} />
          <Route path="/cuenta/hijos/:id" element={<ChildAccountPage />} />
          <Route path="/cuenta" element={<p>Entrar</p>} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  authState.user = { uid: 'firebase-uid', email: 'laura@example.test', displayName: 'Laura' };
  getEstablishment.mockResolvedValue({ id: 'e1', nombre: 'Escuela Sandbox', slug: 'escuela' });
  listDependents.mockResolvedValue(parseDependents(rawChildren));
  issueDependentContext.mockResolvedValue({ access_token: 'hijo-jwt', expires_in: 900 });
  getDependentWallet.mockResolvedValue(wallet);
  listDependentOrders.mockResolvedValue(orders);
  listStudentRequests.mockResolvedValue([]);
  getOperationalStatus.mockResolvedValue({ tutor_habilitado: true });
  getDependentMenuCalendar.mockResolvedValue(
    parseChildMenuCalendar({ programacion: { hoy: '2026-11-17', hora_corte_cancelacion: '08:00' }, dias: [], sin_servicio: [] }),
  );
});

describe('Mis hijos', () => {
  it('muestra el saldo y lo que le queda hoy al aprobado, y al pendiente sin saldo', async () => {
    renderAt('/cuenta/hijos');
    const rows = await screen.findAllByTestId('child-row');
    expect(listDependents).toHaveBeenCalledWith('tutor-jwt');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText('Tilin Ramírez')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('$120.50')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Hoy le quedan: $40')).toBeInTheDocument();
    expect(rows[0]).toHaveAttribute('href', '/cuenta/hijos/u-tilin');
    expect(within(rows[1]!).getByText('Esperando a la escuela')).toBeInTheDocument();
    expect(within(rows[1]!).queryByText(/\$/)).toBeNull();
    expect(rows[1]!.tagName).not.toBe('A');
  });

  it('sin hijos ofrece agregarlo desde aquí', async () => {
    listDependents.mockResolvedValue([]);
    renderAt('/cuenta/hijos');
    expect(await screen.findByText('Aún no tienes hijos en esta escuela')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar a mi hijo' })).toBeInTheDocument();
  });

  it('sin el código de la escuela validado, agregar empieza por ese código', async () => {
    getOperationalStatus.mockResolvedValue({ tutor_habilitado: false });
    getGuardianPrivacyNotice.mockResolvedValue({ version: 'v1', draft: false, title: 'Aviso', paragraphs: [] });
    const user = userEvent.setup();
    renderAt('/cuenta/hijos');
    await screen.findAllByTestId('child-row');
    await waitFor(() => expect(getOperationalStatus).toHaveBeenCalledWith('tutor-jwt'));
    await user.click(screen.getByRole('button', { name: 'Agregar a mi hijo' }));
    expect(await screen.findByRole('heading', { name: 'Código de la escuela' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Validar código' })).toBeDisabled();
  });

  it('con el aviso en borrador no deja agregar hijos', async () => {
    getGuardianPrivacyNotice.mockResolvedValue({ version: 'v1', draft: true, title: 'Aviso', paragraphs: [] });
    const user = userEvent.setup();
    renderAt('/cuenta/hijos');
    await screen.findAllByTestId('child-row');
    await user.click(screen.getByRole('button', { name: 'Agregar a mi hijo' }));
    expect(await screen.findByText(/todavía es un borrador; aún no se pueden agregar hijos/)).toBeInTheDocument();
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByRole('button', { name: 'Agregar a mi hijo' })).toBeDisabled();
  });

  it('el aviso bloquea: sin aceptarlo no muestra saldo ni abre la ficha; al aceptarlo, sí', async () => {
    listDependents.mockResolvedValue(
      parseDependents([{ ...rawChildren[0], requiere_consentimiento: true }]),
    );
    getGuardianPrivacyNotice.mockResolvedValue({
      version: '2026-10-21',
      draft: false,
      title: 'Aviso de privacidad',
      paragraphs: ['Tratamos sus datos para darle de comer.'],
    });
    acceptGuardianPrivacyNotice.mockResolvedValue(parseDependents([rawChildren[0]]));
    const user = userEvent.setup();
    renderAt('/cuenta/hijos');
    expect(await screen.findByText('Falta tu permiso para los datos de Tilin')).toBeInTheDocument();
    // Mientras tanto no se ve nada del hijo ni se puede abrir su ficha.
    const [row] = screen.getAllByTestId('child-row');
    expect(row!.tagName).not.toBe('A');
    expect(within(row!).getByText('Acepta el aviso de privacidad para ver sus datos')).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).toBeNull();
    expect(await screen.findByText('Tratamos sus datos para darle de comer.')).toBeInTheDocument();
    const accept = screen.getByRole('button', { name: 'Aceptar' });
    expect(accept).toBeDisabled();
    await user.click(screen.getByRole('checkbox'));
    await user.click(accept);
    await waitFor(() => expect(screen.queryByText(/Falta tu permiso/)).toBeNull());
    expect(acceptGuardianPrivacyNotice).toHaveBeenCalledWith('tutor-jwt', '2026-10-21', expect.any(String));
    expect(screen.getByText('$120.50')).toBeInTheDocument();
    expect(screen.getByTestId('child-row')).toHaveAttribute('href', '/cuenta/hijos/u-tilin');
  });

  it('un aviso en borrador se puede leer pero no aceptar', async () => {
    listDependents.mockResolvedValue(
      parseDependents([{ ...rawChildren[0], requiere_consentimiento: true }]),
    );
    getGuardianPrivacyNotice.mockResolvedValue({
      version: '2026-10-21',
      draft: true,
      title: 'Aviso de privacidad',
      paragraphs: ['Tratamos sus datos para darle de comer.'],
    });
    renderAt('/cuenta/hijos');
    expect(await screen.findByText('Tratamos sus datos para darle de comer.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('todavía es un borrador');
    expect(screen.queryByRole('button', { name: 'Aceptar' })).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(acceptGuardianPrivacyNotice).not.toHaveBeenCalled();
  });

  it('una tutela sin estado no muestra saldo ni se abre', async () => {
    const { estado: _state, ...withoutState } = rawChildren[0]!;
    void _state;
    listDependents.mockResolvedValue(parseDependents([withoutState]));
    renderAt('/cuenta/hijos');
    const [row] = await screen.findAllByTestId('child-row');
    expect(row!.tagName).not.toBe('A');
    expect(within(row!).getByText('No disponible por ahora')).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('sin sesión manda a entrar', async () => {
    authState.user = null;
    renderAt('/cuenta/hijos');
    expect(await screen.findByText('Entrar')).toBeInTheDocument();
  });
});

describe('Cuenta de un hijo', () => {
  it('lee su saldo, movimientos y pedidos con el token del hijo, no con el del tutor', async () => {
    renderAt('/cuenta/hijos/u-tilin');
    expect(await screen.findByTestId('child-balance')).toHaveTextContent('$95.50');
    expect(issueDependentContext).toHaveBeenCalledWith('tutor-jwt', 'u-tilin');
    expect(issueDependentContext).toHaveBeenCalledTimes(1);
    expect(getDependentWallet).toHaveBeenCalledWith('hijo-jwt');
    expect(listDependentOrders).toHaveBeenCalledWith('hijo-jwt');

    expect(screen.getByText('$40')).toBeInTheDocument();
    expect(screen.getByText('Cacahuate · no se le vende')).toBeInTheDocument();
    expect(screen.getByText('1 producto')).toBeInTheDocument();

    const moves = screen.getByRole('heading', { name: 'Últimos movimientos' }).parentElement!;
    expect(within(moves).getByText('Compra')).toBeInTheDocument();
    expect(within(moves).getByText('−$25')).toBeInTheDocument();
    expect(within(moves).getByText('Recarga en Caja')).toBeInTheDocument();
    expect(within(moves).getByText('+$100')).toBeInTheDocument();

    const ordered = screen.getByRole('heading', { name: 'Lo que pidió' }).parentElement!;
    expect(within(ordered).getByText('1× Torta, 2× Agua')).toBeInTheDocument();
    expect(within(ordered).getByText(/#12 · Entregado/)).toBeInTheDocument();
  });

  it('quien no es el principal solo cambia su aviso de saldo bajo', async () => {
    const notPrincipal = {
      ...rawChildren[0],
      soy_principal: false,
      tutores: [
        { tutela_id: 't1', nombre: 'Laura', principal: true, eres_tu: false },
        { tutela_id: 't2', nombre: 'Pedro', principal: false, eres_tu: true },
      ],
    };
    listDependents.mockResolvedValue(parseDependents([notPrincipal]));
    updateDependent.mockResolvedValue(parseDependent(notPrincipal));
    const user = userEvent.setup();
    renderAt('/cuenta/hijos/u-tilin');
    await screen.findByTestId('child-balance');
    await user.click(screen.getByRole('button', { name: /^Controles$/ }));
    expect(await screen.findByText('El límite, las alergias y lo bloqueado los pone su tutor principal.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Límite diario')).toBeNull();
    await user.type(screen.getByLabelText('Aviso de saldo bajo'), '50');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(updateDependent).toHaveBeenCalledWith('tutor-jwt', 'u-tilin', { umbral_saldo_bajo: '50.00' }, expect.any(String)),
    );
  });

  it('el principal guarda todos los controles sin perder los productos bloqueados', async () => {
    updateDependent.mockResolvedValue(parseDependent(rawChildren[0]));
    const user = userEvent.setup();
    renderAt('/cuenta/hijos/u-tilin');
    await screen.findByTestId('child-balance');
    await user.click(screen.getByRole('button', { name: /^Controles$/ }));
    const limit = await screen.findByLabelText('Límite diario');
    await user.clear(limit);
    await user.type(limit, '80');
    await user.click(screen.getByRole('button', { name: 'Huevo' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(updateDependent).toHaveBeenCalled());
    const body = updateDependent.mock.calls[0]![2] as Record<string, unknown>;
    expect(body).toMatchObject({ limite_diario: '80.00', productos_bloqueados: [5], alergenos: ['cacahuate', 'huevo'] });
  });

  it('muestra lo apartado y lo cancela con el token del hijo', async () => {
    const scheduled = {
      id: 'p20',
      folio: 20,
      estado: 'cobrado',
      total: '20.00',
      version: 3,
      creado_en: '2026-11-17T08:00:00Z',
      fecha_entrega: '2099-01-02',
      items: [{ id: 1, producto_id: 9, nombre_producto: 'Galleta', cantidad: 1 }],
    };
    listDependentOrders.mockResolvedValue([...orders, scheduled]);
    cancelDependentOrder.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderAt('/cuenta/hijos/u-tilin');
    const section = (await screen.findByRole('heading', { name: 'Su comida apartada' })).parentElement!;
    expect(await within(section).findByText('1× Galleta')).toBeInTheDocument();
    await user.click(within(section).getByRole('button', { name: 'Cancelar' }));
    await user.click(screen.getByRole('button', { name: 'Sí, cancelar' }));
    await waitFor(() =>
      expect(cancelDependentOrder).toHaveBeenCalledWith('hijo-jwt', expect.objectContaining({ id: 'p20', version: 3 }), expect.any(String)),
    );
  });

  it('el principal invita a otro tutor con un código', async () => {
    createGuardianInviteCode.mockResolvedValue({ code: 'ABC234', expiresAt: null });
    const user = userEvent.setup();
    renderAt('/cuenta/hijos/u-tilin');
    await screen.findByTestId('child-balance');
    await user.click(screen.getByRole('button', { name: /Invitar a otro tutor/ }));
    expect(await screen.findByText('ABC234')).toBeInTheDocument();
    expect(createGuardianInviteCode).toHaveBeenCalledWith('tutor-jwt', 'u-tilin', expect.any(String));
  });

  it('si el token del hijo vence, pide otro contexto y repite', async () => {
    issueDependentContext
      .mockResolvedValueOnce({ access_token: 'hijo-viejo', expires_in: 900 })
      .mockResolvedValueOnce({ access_token: 'hijo-nuevo', expires_in: 900 });
    const expired = () => Promise.reject(new VaiinillaApiError(401, { code: 'UNAUTHENTICATED', message: 'vencido' }));
    getDependentWallet.mockImplementation((token: string) => (token === 'hijo-viejo' ? expired() : Promise.resolve(wallet)));
    listDependentOrders.mockImplementation((token: string) => (token === 'hijo-viejo' ? expired() : Promise.resolve(orders)));
    renderAt('/cuenta/hijos/u-tilin');
    expect(await screen.findByTestId('child-balance')).toHaveTextContent('$95.50');
    expect(getDependentWallet).toHaveBeenLastCalledWith('hijo-nuevo');
    // Las dos llamadas que fallaron comparten una sola renovación.
    expect(issueDependentContext).toHaveBeenCalledTimes(2);
  });

  it('si la escuela quitó la tutela, avisa que ya no puede verla', async () => {
    issueDependentContext.mockRejectedValue(
      new VaiinillaApiError(403, { code: 'CONTEXT_NOT_ALLOWED', message: 'No.' }),
    );
    renderAt('/cuenta/hijos/u-tilin');
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya no puedes ver la cuenta de Tilin');
    expect(screen.queryByTestId('child-balance')).toBeNull();
  });

  it('sin el aviso vigente aceptado no pide el contexto del hijo ni muestra sus datos', async () => {
    listDependents.mockResolvedValue(
      parseDependents([{ ...rawChildren[0], requiere_consentimiento: true }]),
    );
    renderAt('/cuenta/hijos/u-tilin');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('primero acepta el aviso de privacidad');
    expect(within(alert).getByRole('link', { name: 'Mis hijos' })).toHaveAttribute('href', '/cuenta/hijos');
    expect(issueDependentContext).not.toHaveBeenCalled();
    expect(getDependentWallet).not.toHaveBeenCalled();
    expect(screen.queryByTestId('child-balance')).toBeNull();
    expect(screen.queryByText(/Cacahuate/)).toBeNull();
  });

  it('si el contexto responde 422 por el consentimiento, pide el aviso y no muestra nada', async () => {
    issueDependentContext.mockRejectedValue(
      new VaiinillaApiError(422, { code: 'CONSENT_REQUIRED', message: 'Acepta el aviso.' }),
    );
    renderAt('/cuenta/hijos/u-tilin');
    expect(await screen.findByRole('alert')).toHaveTextContent('primero acepta el aviso de privacidad');
    expect(screen.queryByTestId('child-balance')).toBeNull();
    expect(screen.queryByText(/Cacahuate/)).toBeNull();
    expect(getDependentWallet).not.toHaveBeenCalled();
  });

  it('al cerrar sesión olvida el token del hijo', async () => {
    const clear = vi.spyOn(DependentContextSession.prototype, 'clear');
    const view = renderAt('/cuenta/hijos/u-tilin');
    expect(await screen.findByTestId('child-balance')).toHaveTextContent('$95.50');
    expect(clear).not.toHaveBeenCalled();
    authState.user = null;
    view.rerender(
      <MemoryRouter initialEntries={['/cuenta/hijos/u-tilin']}>
        <ThemeProvider>
          <Routes>
            <Route path="/cuenta/hijos/:id" element={<ChildAccountPage />} />
            <Route path="/cuenta" element={<p>Entrar</p>} />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('Entrar')).toBeInTheDocument();
    expect(clear).toHaveBeenCalled();
    expect(screen.queryByTestId('child-balance')).toBeNull();
    clear.mockRestore();
  });

  it('un hijo pendiente no se abre ni pide contexto', async () => {
    renderAt('/cuenta/hijos/u-mia');
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya no puedes ver la cuenta de Mía');
    expect(issueDependentContext).not.toHaveBeenCalled();
  });

  it('si fallan los pedidos, la ficha sigue con el saldo y lo dice', async () => {
    listDependentOrders.mockRejectedValue(new VaiinillaApiError(500, { code: 'INTERNAL', message: 'x' }));
    renderAt('/cuenta/hijos/u-tilin');
    expect(await screen.findByTestId('child-balance')).toHaveTextContent('$95.50');
    expect(await screen.findByText('No pudimos traer sus pedidos.')).toBeInTheDocument();
  });
});

describe('bandera del modo papás', () => {
  it('apagada, /cuenta/hijos no existe', () => {
    render(
      <MemoryRouter initialEntries={['/cuenta/hijos']}>
        <ThemeProvider>
          <AppRoutes parentMode={false} />
        </ThemeProvider>
      </MemoryRouter>,
    );
    expect(screen.queryByText('Mis hijos')).toBeNull();
    expect(listDependents).not.toHaveBeenCalled();
  });

  it('prendida, /cuenta/hijos abre Mis hijos', async () => {
    render(
      <MemoryRouter initialEntries={['/cuenta/hijos']}>
        <ThemeProvider>
          <AppRoutes parentMode />
        </ThemeProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Mis hijos' })).toBeInTheDocument();
  });
});
