import { describe, expect, it } from 'vitest';
import { VaiinillaApiError } from './api-error';
import {
  accountHeadline,
  accountLines,
  hotelErrorMessage,
  lateCheckoutNote,
  moneyLabel,
  parseHotelConfig,
  parseHotelRequests,
  parseStay,
  roomCharges,
  stayCost,
  stayRange,
  tapRequest,
  DEFAULT_HOTEL_CONFIG,
} from './hotel';

// La estancia tal como la manda `GET /estancias/mia` (docs/hotel.md del backend).
const STAY = {
  id: 'st-1',
  estado: 'en_casa',
  huesped: 'Ana Pérez',
  contacto: null,
  codigo: null,
  espacio_id: 12,
  espacio_nombre: 'Habitación 101',
  piso: 1,
  entrada: '2026-11-09',
  salida: '2026-11-11',
  noches: 2,
  salida_prevista: '2026-11-11T18:00:00.000Z',
  tarifa_noche: '1200.00',
  no_molestar: false,
  total: '2650.00',
  cuenta: {
    noches_total: '2400.00',
    cargos_total: '150.00',
    pedidos_total: '100.00',
    total: '2650.00',
    pedidos_pendientes: 1,
  },
  metodo_cobro: null,
  total_cobrado: null,
  cargos: [{ id: 41, concepto: 'Minibar', categoria: 'minibar', monto: '150.00', creado_en: '2026-11-09T20:00:00.000Z' }],
  pedidos: [
    { id: 'p1', folio: 'A-014', estado: 'cobrado', total: '100.00', items_resumen: '2× Agua', por_cobrar: true, creado_en: null },
    { id: 'p2', folio: 'A-015', estado: 'cobrado', total: '80.00', items_resumen: 'Café', por_cobrar: false, creado_en: null },
  ],
  version: 1,
  ajustes: {
    activo: true,
    cargo_habitacion_activo: true,
    tarjeta_al_pedir: false,
    codigo_entrega_activo: true,
    cocina_desde: '07:00:00',
    cocina_hasta: '23:00',
    solicitudes_activas: true,
    no_molestar_activo: false,
    hora_checkout: '12:00',
    salida_tardia_hora: '15:00',
    salida_tardia_precio: '250.00',
  },
};

describe('lectura de la estancia del huésped', () => {
  it('lee la estancia, su cuenta y los ajustes del hotel', () => {
    const stay = parseStay(STAY);
    expect(stay).toMatchObject({
      id: 'st-1',
      guestName: 'Ana Pérez',
      roomId: 12,
      roomName: 'Habitación 101',
      floor: 1,
      status: 'en_casa',
      nights: 2,
      doNotDisturb: false,
    });
    expect(stay.account).toEqual({
      nightsTotal: '2400.00',
      chargesTotal: '150.00',
      ordersTotal: '100.00',
      total: '2650.00',
      pendingOrders: 1,
    });
    expect(stay.charges[0]).toMatchObject({ id: '41', concept: 'Minibar', category: 'minibar', amount: '150.00' });
    expect(stay.settings).toMatchObject({
      kitchenFrom: '07:00',
      kitchenTo: '23:00',
      doNotDisturbEnabled: false,
      checkoutTime: '12:00',
      lateCheckoutTime: '15:00',
      lateCheckoutPrice: '250.00',
    });
  });

  it('un campo que falta o cambia no tumba la lectura', () => {
    const stay = parseStay({ id: 'x', estado: 'otro_estado', categoria: 'rara' });
    expect(stay).toMatchObject({ id: 'x', status: 'en_casa', nights: 1, charges: [], orders: [], account: null, settings: null });
    expect(parseHotelConfig(undefined)).toEqual(DEFAULT_HOTEL_CONFIG);
  });

  it('lee las solicitudes y cae en «otro» o «pendiente» ante valores nuevos', () => {
    expect(
      parseHotelRequests([
        { id: 'r1', tipo: 'toallas', cantidad: 2, estado: 'tomada' },
        { id: 'r2', tipo: 'jacuzzi', estado: 'nuevo' },
      ]),
    ).toEqual([
      { id: 'r1', type: 'toallas', quantity: 2, note: null, status: 'tomada', createdAt: null },
      { id: 'r2', type: 'otro', quantity: 1, note: null, status: 'pendiente', createdAt: null },
    ]);
    expect(parseHotelRequests(null)).toEqual([]);
  });
});

describe('cuenta de la estancia (H06)', () => {
  it('solo cuenta los pedidos por cobrar de una estancia abierta', () => {
    const stay = parseStay(STAY);
    const lines = accountLines(stay);
    expect(lines.map((line) => line.title)).toEqual(['2× Agua', 'Minibar']);
    expect(roomCharges(stay)).toBe('250.00');
    expect(accountHeadline(stay)).toEqual({ label: 'Cargos a la habitación', amount: '250.00' });
    expect(stayCost(stay)).toBe('2400.00');
  });

  it('una estancia cerrada muestra lo cobrado en el check-out', () => {
    const stay = parseStay({ ...STAY, estado: 'salio', total_cobrado: '2730.00' });
    expect(accountHeadline(stay)).toEqual({ label: 'Total cobrado', amount: '2730.00' });
  });

  it('sin cuenta calculada suma las líneas y la tarifa por noche', () => {
    const stay = parseStay({ ...STAY, cuenta: null });
    expect(roomCharges(stay)).toBe('330.00');
    expect(stayCost(stay)).toBe('2400.00');
  });
});

describe('solicitudes (H05)', () => {
  it('lo que va por cantidad sube hasta cuatro y vuelve a cero; lo demás se prende y se apaga', () => {
    let picked = {};
    for (let i = 0; i < 4; i += 1) picked = tapRequest(picked, 'toallas');
    expect(picked).toEqual({ toallas: 4 });
    picked = tapRequest(picked, 'toallas');
    expect(picked).toEqual({});
    picked = tapRequest(picked, 'limpieza');
    expect(picked).toEqual({ limpieza: 1 });
    expect(tapRequest(picked, 'limpieza')).toEqual({});
  });

  it('describe la salida tardía con hora y precio', () => {
    expect(lateCheckoutNote({ ...DEFAULT_HOTEL_CONFIG, lateCheckoutTime: '15:00', lateCheckoutPrice: '250.00' })).toBe(
      'Hasta las 15:00 · $250 extra',
    );
    expect(lateCheckoutNote(DEFAULT_HOTEL_CONFIG)).toBe('Pide más tiempo');
  });
});

describe('textos', () => {
  it('fechas y dinero', () => {
    expect(stayRange('2026-11-06', '2026-11-09')).toBe('del 6 al 9 de nov');
    expect(stayRange('2026-10-30', '2026-11-02')).toBe('del 30 oct al 2 de nov');
    expect(stayRange('', '2026-11-02')).toBeNull();
    expect(moneyLabel('350.00')).toBe('$350');
    expect(moneyLabel('350.5')).toBe('$350.50');
    expect(moneyLabel(null)).toBe('—');
  });

  it('dice los errores del hotel con sus palabras', () => {
    expect(hotelErrorMessage(new VaiinillaApiError(404, { code: 'STAY_NOT_FOUND', message: 'x' }))).toMatch(/no coincide o ya venció/);
    expect(hotelErrorMessage(new VaiinillaApiError(429, { code: 'RATE_LIMITED', message: 'x' }))).toMatch(/Demasiados intentos/);
    expect(hotelErrorMessage(new VaiinillaApiError(422, { code: 'REQUESTS_DISABLED', message: 'x' }))).toMatch(/no recibe solicitudes/);
    expect(hotelErrorMessage(new TypeError('boom'), 'General')).toBe('General');
  });
});
