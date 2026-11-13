import { describe, expect, it } from 'vitest';
import { VaiinillaApiError } from './api-error';
import {
  assistantErrorMessage,
  assistantReducer,
  canSend,
  cleanGuestName,
  courtAvailability,
  encodeTurns,
  initialAssistantState,
  isAssistantDisabled,
  latestOrderTurn,
  MAX_LETTERS,
  MAX_MESSAGES,
  parseReply,
  type AssistantReply,
} from './customer-assistant';
import { parseFeatureFlag, showsCustomerAssistant } from './customer-assistant-flag';

const reply = (overrides: Partial<AssistantReply> = {}): AssistantReply => ({
  message: 'Te recomiendo el chocolate.',
  products: [],
  order: null,
  waiter: null,
  options: [],
  remainingMessages: 30,
  courts: [],
  ...overrides,
});

describe('bandera del asistente', () => {
  it('solo se prende con "true"', () => {
    expect(parseFeatureFlag(undefined)).toBe(false);
    expect(parseFeatureFlag('')).toBe(false);
    expect(parseFeatureFlag('1')).toBe(false);
    expect(parseFeatureFlag('false')).toBe(false);
    expect(parseFeatureFlag(' TRUE ')).toBe(true);
  });

  it('está apagada por defecto en las pruebas (sin la variable)', async () => {
    const flag = await import('./customer-assistant-flag');
    expect(flag.CUSTOMER_ASSISTANT_ENABLED).toBe(false);
    expect(showsCustomerAssistant({ asistente_clientes: true })).toBe(false);
  });

  it('con la bandera, sale salvo que la tienda lo apague (ausente = sí, como Android)', () => {
    expect(showsCustomerAssistant({}, true)).toBe(true);
    expect(showsCustomerAssistant({ asistente_clientes: true }, true)).toBe(true);
    expect(showsCustomerAssistant({ asistente_clientes: false }, true)).toBe(false);
    expect(showsCustomerAssistant(null, true)).toBe(false);
  });
});

describe('encodeTurns', () => {
  it('manda rol, texto y el establecimiento como número', () => {
    expect(encodeTurns([{ fromCustomer: true, text: 'hola' }, { fromCustomer: false, text: '¿qué?' }], '12')).toEqual({
      establecimiento_id: 12,
      mensajes: [
        { rol: 'cliente', texto: 'hola' },
        { rol: 'asistente', texto: '¿qué?' },
      ],
    });
  });

  it('recorta a los últimos 40 mensajes de 600 letras y omite el lugar vacío', () => {
    const turns = Array.from({ length: 45 }, (_, i) => ({ fromCustomer: i % 2 === 0, text: `${i}`.padEnd(700, 'x') }));
    const body = encodeTurns(turns, null);
    expect(body).not.toHaveProperty('establecimiento_id');
    expect(body.mensajes).toHaveLength(MAX_MESSAGES);
    expect(body.mensajes[0]?.texto.startsWith('5')).toBe(true);
    expect(body.mensajes.every((m) => m.texto.length === MAX_LETTERS)).toBe(true);
  });
});

describe('parseReply', () => {
  it('lee productos, pedido, mesero, opciones y pistas del sobre { data }', () => {
    const parsed = parseReply({
      data: {
        mensaje: '  Va  ',
        productos: [
          { producto_id: 10, nombre: 'Chocolate', precio: '38.00', imagen_url: '', disponible: true, minutos: 4 },
          { nombre: 'sin id' },
        ],
        pedido: {
          lineas: [{ producto_id: 10, nombre: 'Chocolate', precio: '38.00', cantidad: 99, nota: ' sin azúcar ' }],
          total: '76.00',
          no_disponibles: ['Flan'],
          por_elegir: [{ producto_id: 3, nombre: 'Burrito' }],
        },
        llamar_mesero: { motivo: 'utensilios', detalle: 'Servilletas' },
        opciones: ['Sí', ' ', 'No'],
        quedan_mensajes: 12,
        pistas: [
          { espacio_id: 7, nombre: 'Pádel 1', libre_ahora: true, libre_hasta: '18:00', precio_hora: { efectivo_saldo: '250.00', tarjeta: '262.50' }, capacidad: 4 },
          { espacio_id: 7, nombre: 'repetida' },
          { espacio_id: 8, precio_hora: '300.00', capacidad: 0 },
          { espacio_id: 9 },
          { espacio_id: 10 },
          { espacio_id: 11 },
        ],
      },
    });
    expect(parsed.message).toBe('Va');
    expect(parsed.products).toEqual([
      { productId: 10, name: 'Chocolate', price: '38.00', imageUrl: null, available: true, needsOptions: false, minutes: 4 },
    ]);
    expect(parsed.order).toEqual({
      lines: [
        {
          product: { productId: 10, name: 'Chocolate', price: '38.00', imageUrl: null, available: true, needsOptions: false, minutes: null },
          quantity: 20,
          note: 'sin azúcar',
        },
      ],
      total: '76.00',
      unavailable: ['Flan'],
      toChoose: ['Burrito'],
    });
    expect(parsed.waiter).toEqual({ reason: 'utensilios', detail: 'Servilletas' });
    expect(parsed.options).toEqual(['Sí', 'No']);
    expect(parsed.remainingMessages).toBe(12);
    expect(parsed.courts.map((c) => c.courtId)).toEqual([7, 8, 9, 10]);
    expect(parsed.courts[0]).toMatchObject({ name: 'Pádel 1', pricePerHour: '250.00', cardPricePerHour: '262.50', capacity: 4 });
    expect(parsed.courts[1]).toMatchObject({ name: 'Pista', pricePerHour: '300.00', cardPricePerHour: null, capacity: null });
  });

  it('ignora un pedido vacío y un motivo de mesero desconocido; sin quedan_mensajes asume 40', () => {
    const parsed = parseReply({ mensaje: 'Hola', pedido: { lineas: [] }, llamar_mesero: { motivo: 'baile' } });
    expect(parsed.order).toBeNull();
    expect(parsed.waiter).toBeNull();
    expect(parsed.remainingMessages).toBe(MAX_MESSAGES);
  });
});

describe('mensajes de error', () => {
  it('dice tal cual lo que explica el servidor del asistente', () => {
    const disabled = new VaiinillaApiError(403, { code: 'ASSISTANT_DISABLED', message: 'Este negocio apagó el asistente.' });
    expect(assistantErrorMessage(disabled)).toBe('Este negocio apagó el asistente.');
    expect(isAssistantDisabled(disabled)).toBe(true);
    const mismatch = new VaiinillaApiError(409, { code: 'CONTEXT_MISMATCH', message: 'Estás en otro lugar.' });
    expect(assistantErrorMessage(mismatch)).toBe('Estás en otro lugar.');
    expect(isAssistantDisabled(mismatch)).toBe(false);
  });

  it('lo demás es un aviso genérico', () => {
    expect(assistantErrorMessage(new VaiinillaApiError(500, { code: 'INTERNAL', message: 'stack' }))).toBe(
      'No pude contestar. Intenta de nuevo.',
    );
    expect(assistantErrorMessage(new Error('x'))).toBe('No pude contestar. Intenta de nuevo.');
  });
});

describe('courtAvailability y nombre', () => {
  it('dice si está libre u ocupada', () => {
    const base = { courtId: 1, name: 'P', freeNow: true, freeUntil: null, busyUntil: null, pricePerHour: null, cardPricePerHour: null, capacity: null };
    expect(courtAvailability({ ...base, freeUntil: '18:00' })).toBe('Libre hasta las 18:00');
    expect(courtAvailability(base)).toBe('Libre ahora');
    expect(courtAvailability({ ...base, freeNow: false, busyUntil: '17:30' })).toBe('Ocupada hasta las 17:30');
    expect(courtAvailability({ ...base, freeNow: false })).toBe('Ocupada ahora');
  });

  it('limpia el nombre del invitado', () => {
    expect(cleanGuestName('  Ana   María ')).toBe('Ana María');
    expect(cleanGuestName('x'.repeat(80))).toHaveLength(60);
  });
});

describe('assistantReducer', () => {
  it('agrega el turno del cliente y la respuesta, con opciones y mensajes restantes', () => {
    let state = assistantReducer(initialAssistantState(), { type: 'send', text: '  hola  ' });
    expect(state.turns).toEqual([{ fromCustomer: true, text: 'hola' }]);
    state = assistantReducer(state, { type: 'thinking', conversation: 0 });
    expect(canSend(state)).toBe(false);
    state = assistantReducer(state, { type: 'reply', conversation: 0, reply: reply({ message: '', options: ['Sí'] }) });
    expect(state.thinking).toBe(false);
    expect(state.turns[1]).toMatchObject({ fromCustomer: false, text: '¿Qué se te antoja?' });
    expect(state.options).toEqual(['Sí']);
    expect(state.remaining).toBe(30);
  });

  it('una respuesta de una plática anterior ya no entra', () => {
    let state = assistantReducer(initialAssistantState(), { type: 'send', text: 'hola' });
    state = assistantReducer(state, { type: 'restart' });
    const after = assistantReducer(state, { type: 'reply', conversation: 0, reply: reply() });
    expect(after).toBe(state);
    expect(after.turns).toHaveLength(0);
  });

  it('ASSISTANT_DISABLED cierra la plática; con 1 mensaje restante ya no se manda', () => {
    let state = assistantReducer(initialAssistantState(), { type: 'send', text: 'hola' });
    state = assistantReducer(state, { type: 'failed', conversation: 0, message: 'Apagado', closed: true });
    expect(state.closed).toBe(true);
    expect(canSend(state)).toBe(false);
    const tired = { ...initialAssistantState(), remaining: 1 };
    expect(canSend(tired)).toBe(false);
    expect(assistantReducer(tired, { type: 'send', text: 'otra' })).toBe(tired);
  });

  it('solo el pedido más reciente cuenta y el carrito vacío olvida el anterior', () => {
    const order = { lines: [], total: '0', unavailable: ['Flan'], toChoose: [] };
    let state = assistantReducer(initialAssistantState(), { type: 'send', text: 'a' });
    state = assistantReducer(state, { type: 'reply', conversation: 0, reply: reply({ order }) });
    state = assistantReducer(state, { type: 'send', text: 'b' });
    state = assistantReducer(state, { type: 'reply', conversation: 0, reply: reply({ order }) });
    expect(latestOrderTurn(state)).toBe(3);
    const line = { product: { productId: 1, name: 'A', price: '1.00', imageUrl: null, available: true, needsOptions: false, minutes: null }, quantity: 1, note: null };
    state = assistantReducer(state, { type: 'orderInCart', turn: 3, added: [line] });
    expect(state.done).toEqual([3]);
    expect(state.cartOrder).toEqual([line]);
    state = assistantReducer(state, { type: 'forgetCartOrder' });
    expect(state.cartOrder).toEqual([]);
  });

  it('pide el nombre del invitado y luego lo suelta', () => {
    let state = assistantReducer(initialAssistantState(), { type: 'send', text: 'hola' });
    state = assistantReducer(state, { type: 'needsName', conversation: 0 });
    expect(state.needsName).toBe(true);
    expect(canSend(state)).toBe(false);
    state = assistantReducer(state, { type: 'nameAccepted' });
    expect(state.needsName).toBe(false);
  });
});
