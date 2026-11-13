import { describe, expect, it, vi } from 'vitest';
import { parseFeatureFlag } from './features';
import {
  allergensLine,
  blockedLine,
  canViewDependent,
  dailyRemainingLabel,
  DependentContextSession,
  isConsentRequired,
  movementLabel,
  orderSummary,
  parseDependents,
  parsePrivacyNotice,
  signedAmount,
} from './guardianship';

const approved = {
  usuario_id: 'u-tilin',
  nombre: 'Tilin Ramírez',
  grupo: '3B',
  foto_url: null,
  matricula: 'A100',
  tiene_cuenta: false,
  estado: 'aprobada',
  requiere_consentimiento: false,
  soy_principal: false,
  tutores: [
    { tutela_id: 't1', nombre: 'Laura Ramírez', principal: true, eres_tu: false },
    { tutela_id: 't2', nombre: 'Pedro Ramírez', principal: false, eres_tu: true },
  ],
  tiene_pin: true,
  credenciales: { qr: false, nfc: true },
  saldo: '120.50',
  controles: {
    limite_diario: '60.00',
    gastado_hoy: '20.00',
    disponible_hoy: '40.00',
    umbral_saldo_bajo: null,
    notas: null,
    productos_bloqueados: [3, 4],
    categorias_bloqueadas: [9],
    alergenos: ['cacahuate', 'gluten', 'desconocido'],
  },
};

const pending = {
  usuario_id: 'u-mia',
  nombre: 'Mía',
  grupo: null,
  matricula: 'A200',
  estado: 'pendiente',
  requiere_consentimiento: true,
  saldo: null,
  controles: null,
};

describe('parseDependents', () => {
  it('lee a un hijo aprobado con su saldo, controles y tutores', () => {
    const [child] = parseDependents([approved]);
    expect(child).toMatchObject({
      userId: 'u-tilin',
      name: 'Tilin Ramírez',
      group: '3B',
      studentId: 'A100',
      state: 'aprobada',
      balance: '120.50',
      isPrincipal: false,
      hasPin: true,
      hasCredential: true,
      needsConsent: false,
    });
    expect(child?.controls).toMatchObject({
      dailyLimit: '60.00',
      spentToday: '20.00',
      availableToday: '40.00',
      blockedProductIds: [3, 4],
      blockedCategoryIds: [9],
    });
    expect(child?.guardians.map((guardian) => guardian.name)).toEqual(['Laura Ramírez', 'Pedro Ramírez']);
  });

  it('un hijo pendiente no tiene saldo ni controles: no se trata como cero', () => {
    const [child] = parseDependents([pending]);
    expect(child?.state).toBe('pendiente');
    expect(child?.balance).toBeNull();
    expect(child?.controls).toBeNull();
    expect(child?.needsConsent).toBe(true);
  });

  it('aunque un pendiente traiga saldo, no se muestra', () => {
    const [child] = parseDependents([{ ...pending, saldo: '50.00', controles: approved.controles }]);
    expect(child?.balance).toBeNull();
    expect(child?.controls).toBeNull();
  });

  it('sin soy_principal (backend viejo) el tutor es dueño de los controles', () => {
    const { soy_principal: _ignored, ...old } = approved;
    void _ignored;
    const [child] = parseDependents([old]);
    expect(child?.isPrincipal).toBe(true);
    expect(child?.state).toBe('aprobada');
  });

  it('sin estado, con estado nulo o desconocido no se trata como aprobada ni enseña datos', () => {
    const { estado: _state, ...withoutState } = approved;
    void _state;
    for (const raw of [withoutState, { ...approved, estado: null }, { ...approved, estado: 'rechazada' }]) {
      const [child] = parseDependents([raw]);
      expect(child?.state).toBe('desconocido');
      expect(child?.balance).toBeNull();
      expect(child?.controls).toBeNull();
      expect(canViewDependent(child!)).toBe(false);
    }
  });

  it('aprobado pero sin el aviso vigente aceptado: no guarda saldo, notas, bloqueos ni alérgenos', () => {
    const [child] = parseDependents([
      { ...approved, requiere_consentimiento: true, controles: { ...approved.controles, notas: 'Diabético' } },
    ]);
    expect(child?.state).toBe('aprobada');
    expect(child?.needsConsent).toBe(true);
    expect(child?.balance).toBeNull();
    expect(child?.controls).toBeNull();
    expect(canViewDependent(child!)).toBe(false);
    expect(canViewDependent(parseDependents([approved])[0]!)).toBe(true);
  });

  it('omite filas sin id y respuestas que no son lista', () => {
    expect(parseDependents([{ nombre: 'Sin id' }, approved])).toHaveLength(1);
    expect(parseDependents(null)).toEqual([]);
    expect(parseDependents({ data: [] })).toEqual([]);
  });
});

describe('textos de la ficha', () => {
  const [child] = parseDependents([approved]);

  it('alergias con su nombre, ordenadas, sin códigos desconocidos', () => {
    expect(allergensLine(child!.controls)).toBe('Cacahuate, Gluten · no se le vende');
    expect(allergensLine(null)).toBe('Ninguna anotada');
  });

  it('lo bloqueado en categorías y productos', () => {
    expect(blockedLine(child!.controls)).toBe('1 categoría y 2 productos');
    expect(blockedLine(null)).toBe('Nada bloqueado');
  });

  it('hoy le quedan: lo disponible, "Sin límite" o nada', () => {
    expect(dailyRemainingLabel(child!.controls)).toBe('$40');
    expect(dailyRemainingLabel({ ...child!.controls!, dailyLimit: null, availableToday: null })).toBe('Sin límite');
    expect(dailyRemainingLabel({ ...child!.controls!, availableToday: null })).toBeNull();
    expect(dailyRemainingLabel(null)).toBeNull();
  });

  it('nombra los movimientos como Android', () => {
    expect(movementLabel({ tipo: 'recarga_efectivo', descripcion: '' })).toBe('Recarga en Caja');
    expect(movementLabel({ tipo: 'recarga_stripe', descripcion: '' })).toBe('Recarga con tarjeta');
    expect(movementLabel({ tipo: 'compra', descripcion: 'Pedido 12' })).toBe('Compra');
    expect(movementLabel({ tipo: 'cancelacion', descripcion: '' })).toBe('Devolución por cancelación');
    expect(movementLabel({ tipo: 'ajuste', descripcion: '' })).toBe('Ajuste autorizado');
    expect(movementLabel({ tipo: 'ajuste', descripcion: 'Corrección' })).toBe('Corrección');
    expect(movementLabel({ tipo: 'otro', descripcion: 'Algo nuevo' })).toBe('Algo nuevo');
  });

  it('pone el signo al monto', () => {
    expect(signedAmount('-45.00')).toBe('−$45');
    expect(signedAmount('100.50')).toBe('+$100.50');
  });

  it('resume lo que pidió', () => {
    expect(
      orderSummary({
        items: [
          { cantidad: 2, nombre_producto: 'Torta' },
          { cantidad: 1, nombre_producto: 'Agua' },
        ] as never,
      }),
    ).toBe('2× Torta, 1× Agua');
  });
});

describe('parsePrivacyNotice', () => {
  it('lee la versión, el borrador y los párrafos', () => {
    expect(parsePrivacyNotice({ version: '2026-10-21', borrador: true, titulo: 'Aviso', parrafos: ['a', 'b'] })).toEqual({
      version: '2026-10-21',
      draft: true,
      title: 'Aviso',
      paragraphs: ['a', 'b'],
    });
    expect(parsePrivacyNotice({})).toBeNull();
  });
});

describe('isConsentRequired', () => {
  it('reconoce el 422 de consentimiento y nada más', () => {
    expect(isConsentRequired({ status: 422, code: 'CONSENT_REQUIRED' })).toBe(true);
    expect(isConsentRequired({ status: 422, code: 'GUARDIAN_CONSENT_REQUIRED' })).toBe(true);
    expect(isConsentRequired({ status: 422, code: 'STUDENT_NOT_IN_ROSTER' })).toBe(false);
    expect(isConsentRequired({ status: 403, code: 'CONTEXT_NOT_ALLOWED' })).toBe(false);
    expect(isConsentRequired(null)).toBe(false);
  });
});

describe('DependentContextSession', () => {
  it('clear olvida el token del hijo y el siguiente uso pide otro', async () => {
    const issue = vi
      .fn()
      .mockResolvedValueOnce({ access_token: 'hijo-1', expires_in: 900 })
      .mockResolvedValueOnce({ access_token: 'hijo-2', expires_in: 900 });
    const session = new DependentContextSession(issue);
    await expect(session.validToken()).resolves.toBe('hijo-1');
    session.clear();
    await expect(session.validToken()).resolves.toBe('hijo-2');
    expect(issue).toHaveBeenCalledTimes(2);
  });

  it('una emisión que termina después de clear no deja el token guardado', async () => {
    let resolveIssue: (grant: { access_token: string; expires_in: number }) => void = () => undefined;
    const issue = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => (resolveIssue = resolve)))
      .mockResolvedValueOnce({ access_token: 'hijo-2', expires_in: 900 });
    const session = new DependentContextSession(issue);
    const pending = session.validToken();
    session.clear();
    resolveIssue({ access_token: 'hijo-1', expires_in: 900 });
    await pending;
    await expect(session.validToken()).resolves.toBe('hijo-2');
  });

  it('reusa el token del hijo mientras falte más de un minuto y lo renueva antes de que venza', async () => {
    let now = 0;
    const issue = vi
      .fn()
      .mockResolvedValueOnce({ access_token: 'hijo-1', expires_in: 900 })
      .mockResolvedValueOnce({ access_token: 'hijo-2', expires_in: 900 });
    const session = new DependentContextSession(issue, () => now);
    await expect(session.validToken()).resolves.toBe('hijo-1');
    now = 800_000;
    await expect(session.validToken()).resolves.toBe('hijo-1');
    now = 850_000;
    await expect(session.validToken()).resolves.toBe('hijo-2');
    expect(issue).toHaveBeenCalledTimes(2);
  });

  it('dos llamadas a la vez esperan la misma emisión', async () => {
    const issue = vi.fn().mockResolvedValue({ access_token: 'hijo', expires_in: 900 });
    const session = new DependentContextSession(issue);
    await Promise.all([session.validToken(), session.validToken()]);
    expect(issue).toHaveBeenCalledTimes(1);
  });

  it('un 401 renueva solo el token del hijo y repite una vez', async () => {
    const issue = vi
      .fn()
      .mockResolvedValueOnce({ access_token: 'viejo', expires_in: 900 })
      .mockResolvedValueOnce({ access_token: 'nuevo', expires_in: 900 });
    const session = new DependentContextSession(issue);
    const call = vi.fn((token: string) =>
      token === 'viejo' ? Promise.reject(Object.assign(new Error('vencido'), { status: 401 })) : Promise.resolve(token),
    );
    await expect(session.run(call)).resolves.toBe('nuevo');
    expect(call.mock.calls.map(([token]) => token)).toEqual(['viejo', 'nuevo']);
  });

  it('otros errores llegan tal cual, sin renovar', async () => {
    const issue = vi.fn().mockResolvedValue({ access_token: 'hijo', expires_in: 900 });
    const session = new DependentContextSession(issue);
    const failure = Object.assign(new Error('prohibido'), { status: 403 });
    await expect(session.run(() => Promise.reject(failure))).rejects.toBe(failure);
    expect(issue).toHaveBeenCalledTimes(1);
  });
});

describe('parseFeatureFlag', () => {
  it('solo "true" prende la bandera', () => {
    expect(parseFeatureFlag('true')).toBe(true);
    expect(parseFeatureFlag(' TRUE ')).toBe(true);
    expect(parseFeatureFlag(undefined)).toBe(false);
    expect(parseFeatureFlag('')).toBe(false);
    expect(parseFeatureFlag('false')).toBe(false);
    expect(parseFeatureFlag('1')).toBe(false);
  });
});
