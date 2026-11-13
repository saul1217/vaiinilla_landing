import { describe, expect, it } from 'vitest';
import type { Breadcrumb, ErrorEvent } from '@sentry/react';
import { beforeBreadcrumb, beforeSend, redactString, scrubUrl } from './monitoring';
import monitoringSource from './monitoring.ts?raw';

// Tokens de ejemplo (no reales), armados en partes para que el escáner de secretos no los tome por unos.
const b64url = (text: string) => btoa(text).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const JWT = [b64url('{"alg":"HS256"}'), b64url('{"sub":"prueba"}'), 'firma_de_prueba_123'].join('.');
/** Token del hijo en modo papás: JWT de `POST /tutelas/:id/contexto` con el claim tutor_usuario_id. */
const CHILD_JWT = [
  b64url('{"alg":"HS256","typ":"JWT"}'),
  b64url('{"sub":"hijo-1","tutor_usuario_id":"tutor-9"}'),
  'firma_hijo_456',
].join('.');
const VILLO = ['villo', '3q2-7wY2mJ0Qx0b1K9f8VgW5hN4cR6tZ1uA2sD3fG4h'].join('_');

const send = (event: Record<string, unknown>) => beforeSend(event as unknown as ErrorEvent);
const crumb = (b: Breadcrumb) => beforeBreadcrumb(b);

describe('monitoring: JWT en mensajes y URLs', () => {
  it('tapa el JWT del mensaje, de la excepción y de la URL del evento', () => {
    const out = send({
      message: `fallo al pedir con ${JWT} en la caja`,
      exception: { values: [{ type: 'ApiError', value: `401: ${JWT}` }] },
      request: { url: `https://api.vaiinilla.app/v1/pedidos?token=${JWT}&page=2` },
      transaction: `/pedir?access_token=${JWT}`,
    });
    expect(out.message).toBe('fallo al pedir con [Filtered] en la caja');
    expect(out.exception?.values?.[0]).toEqual({ type: 'ApiError', value: '401: [Filtered]' });
    expect(out.request?.url).toBe('https://api.vaiinilla.app/v1/pedidos?token=[Filtered]&page=2');
    expect(out.transaction).toBe('/pedir?access_token=[Filtered]');
    expect(JSON.stringify(out)).not.toContain('eyJ');
  });

  it('tapa el JWT en el mensaje y las URLs de un breadcrumb de fetch y de navegación', () => {
    const fetch = crumb({
      category: 'fetch',
      message: `GET /v1/wallets/me con ${JWT}`,
      data: { method: 'GET', url: `https://api.vaiinilla.app/v1/x?id_token=${JWT}`, status_code: 401 },
    });
    expect(fetch?.message).toBe('GET /v1/wallets/me con [Filtered]');
    expect(fetch?.data).toEqual({
      method: 'GET',
      url: 'https://api.vaiinilla.app/v1/x?id_token=[Filtered]',
      status_code: 401,
    });

    const nav = crumb({ category: 'navigation', data: { from: `/cuenta#${JWT}`, to: '/e/cafe/m/AbC123xyz/quien' } });
    expect(nav?.data).toEqual({ from: '/cuenta#[Filtered]', to: '/e/cafe/m/[Filtered]/quien' });
  });

  it('tapa los tokens de mesa, de seguimiento y villo_ en la ruta o en el texto', () => {
    expect(scrubUrl('https://vaiinilla.app/seguimiento/tok_abc123?x=1')).toBe(
      'https://vaiinilla.app/seguimiento/[Filtered]?x=1',
    );
    expect(scrubUrl('/cafe/m/AbC123xyz')).toBe('/cafe/m/[Filtered]');
    expect(redactString(VILLO)).toBe('[Filtered]');
    expect(redactString(`dispositivo ${VILLO} sin red`)).toBe('dispositivo [Filtered] sin red');
  });
});

describe('monitoring: token del hijo en modo papás', () => {
  it('tapa el token del hijo en la respuesta de /tutelas/:id/contexto y en las llamadas con él', () => {
    const b = crumb({
      category: 'fetch',
      message: `GET /v1/pedidos Authorization: Bearer ${CHILD_JWT}`,
      data: {
        url: 'https://api.vaiinilla.app/v1/tutelas/hijo-1/contexto',
        respuesta: { access_token: CHILD_JWT, expira_en: 900, dependiente_id: 'hijo-1' },
        childToken: CHILD_JWT,
        token_hijo: 'opaco-sin-forma-de-jwt',
        body: JSON.stringify({ access_token: CHILD_JWT, expira_en: 900 }),
      },
    });
    expect(b?.message).toBe('GET /v1/pedidos Authorization: Bearer [Filtered]');
    expect(b?.data).toEqual({
      url: 'https://api.vaiinilla.app/v1/tutelas/hijo-1/contexto',
      respuesta: { access_token: '[Filtered]', expira_en: 900, dependiente_id: 'hijo-1' },
      childToken: '[Filtered]',
      token_hijo: '[Filtered]',
      body: JSON.stringify({ access_token: '[Filtered]', expira_en: 900 }),
    });
  });

  it('tapa el token del hijo en extra, contexts, tags y en query params', () => {
    const out = send({
      message: `401 renovando el contexto del hijo {"access_token":"${CHILD_JWT}"`,
      extra: { modoPapas: { hijo: { id: 'hijo-1', token: CHILD_JWT, nombre: 'Luis' } } },
      contexts: { tutela: { sesion: CHILD_JWT } },
      tags: { child_token: CHILD_JWT, pantalla: 'modo-papas' },
      request: { url: `https://vaiinilla.app/cuenta/saldo?child_token=abc&hijo=1` },
    });
    expect(out.message).toBe('401 renovando el contexto del hijo {"access_token":"[Filtered]"');
    // nombre también se tapa desde que es llave personal (nombre del invitado del asistente).
    expect(out.extra).toEqual({ modoPapas: { hijo: { id: 'hijo-1', token: '[Filtered]', nombre: '[Filtered]' } } });
    expect(out.contexts).toEqual({ tutela: { sesion: '[Filtered]' } });
    expect(out.tags).toEqual({ child_token: '[Filtered]', pantalla: 'modo-papas' });
    expect(out.request?.url).toBe('https://vaiinilla.app/cuenta/saldo?child_token=[Filtered]&hijo=1');
    expect(JSON.stringify(out)).not.toContain('tutor-9');
  });
});

describe('monitoring: header Authorization', () => {
  it('quita Authorization, cookies y headers de token del request y limpia los demás', () => {
    const out = send({
      request: {
        url: 'https://api.vaiinilla.app/v1/wallets/me',
        headers: {
          Authorization: `Bearer ${CHILD_JWT}`,
          Cookie: 'sesion=1',
          'X-Device-Token': VILLO,
          'X-Api-Key': 'k1',
          Accept: 'application/json',
          Referer: `https://vaiinilla.app/pedir?token=${JWT}`,
        },
        cookies: { sesion: '1' },
      },
    });
    expect(out.request?.headers).toEqual({
      Accept: 'application/json',
      Referer: 'https://vaiinilla.app/pedir?token=[Filtered]',
    });
    expect(out.request?.cookies).toBeUndefined();
  });

  it('tapa el header Authorization dentro de breadcrumbs (objeto o texto)', () => {
    const b = crumb({
      category: 'xhr',
      message: 'authorization: Bearer abc.def',
      data: { request_headers: { Authorization: 'Bearer opaco123', 'Content-Type': 'application/json' } },
    });
    expect(b?.message).toBe('authorization: Bearer [Filtered]');
    expect(b?.data).toEqual({
      request_headers: { Authorization: '[Filtered]', 'Content-Type': 'application/json' },
    });
  });
});

describe('monitoring: query params sensibles', () => {
  const query = (query_string: unknown) =>
    send({ request: { url: 'https://vaiinilla.app/a', query_string } }).request?.query_string;

  it('tapa los parámetros sensibles en las URLs (Firebase, Stripe, tokens, búsqueda)', () => {
    expect(
      scrubUrl(
        '/acceso/recuperar?mode=resetPassword&oobCode=ABC123&apiKey=AIza1' +
          '&payment_intent=pi_1&payment_intent_client_secret=pi_1_secret_2&redirect_status=succeeded&q=Luis Pérez',
      ),
    ).toBe(
      '/acceso/recuperar?mode=resetPassword&oobCode=[Filtered]&apiKey=[Filtered]' +
        '&payment_intent=pi_1&payment_intent_client_secret=[Filtered]&redirect_status=succeeded&q=[Filtered]',
    );
    expect(scrubUrl('/cuenta?nuevo=1&refresh_token=r&marketing=1')).toBe(
      '/cuenta?nuevo=[Filtered]&refresh_token=[Filtered]&marketing=1',
    );
  });

  it('tapa query_string como cadena', () => {
    expect(query(`?token=t&oobCode=c&client_secret=s&j=${JWT}&d=${VILLO}&mesa=4&correo=a@b.mx`)).toBe(
      '?token=[Filtered]&oobCode=[Filtered]&client_secret=[Filtered]&j=[Filtered]&d=[Filtered]&mesa=4&correo=[Filtered]',
    );
  });

  it('tapa query_string como objeto y como lista de pares', () => {
    expect(query({ access_token: 'a', code: '123', j: JWT, page: '2', q: 'Ana' })).toEqual({
      access_token: '[Filtered]',
      code: '[Filtered]',
      j: '[Filtered]',
      page: '2',
      q: '[Filtered]',
    });
    expect(
      query([
        ['child_token', 'c'],
        ['payment_intent_client_secret', 'pi_secret'],
        ['page', '2'],
      ]),
    ).toEqual([
      ['child_token', '[Filtered]'],
      ['payment_intent_client_secret', '[Filtered]'],
      ['page', '2'],
    ]);
  });
});

describe('monitoring: datos personales', () => {
  it('quita el usuario y el cuerpo de la petición, y tapa correos y teléfonos del evento', () => {
    const out = send({
      user: { id: 'u1', email: 'ana@correo.mx', ip_address: '10.0.0.1' },
      message: 'No se pudo registrar ana@correo.mx con el 55 1234 5678',
      exception: { values: [{ type: 'Error', value: 'teléfono +52 5512345678 inválido' }] },
      request: { url: 'https://vaiinilla.app/acceso?email=ana%40correo.mx', data: { password: 'nunca' } },
      extra: {
        perfil: { nombre_completo: 'Ana López', telefono: '5512345678', fecha_nacimiento: '2010-01-01', mesa: 4 },
        formulario: JSON.stringify({ email: 'ana@correo.mx', password: 'x', cantidad: 2 }),
      },
    });
    expect(out.user).toBeUndefined();
    expect(out.request?.data).toBeUndefined();
    expect(out.message).toBe('No se pudo registrar [email] con el [telefono]');
    expect(out.exception?.values?.[0]?.value).toBe('teléfono [telefono] inválido');
    expect(out.request?.url).toBe('https://vaiinilla.app/acceso?email=[Filtered]');
    expect(out.extra).toEqual({
      perfil: { nombre_completo: '[Filtered]', telefono: '[Filtered]', fecha_nacimiento: '[Filtered]', mesa: 4 },
      formulario: JSON.stringify({ email: '[Filtered]', password: '[Filtered]', cantidad: 2 }),
    });
    expect(JSON.stringify(out)).not.toMatch(/ana@|5512345678|1234 5678|L[oó]pez|nunca/);
  });

  it('tapa datos personales en breadcrumbs (ui.input, console y respuestas)', () => {
    const b = crumb({
      category: 'console',
      message: 'enviando {"correo":"luis@escuela.mx", "telefono":"5598765432"',
      data: { arguments: ['cliente', { email: 'luis@escuela.mx', direccion: 'Calle 1', total: 99 }] },
    });
    expect(b?.message).toBe('enviando {"correo":"[Filtered]", "telefono":"[Filtered]"');
    expect(b?.data).toEqual({
      arguments: ['cliente', { email: '[Filtered]', direccion: '[Filtered]', total: 99 }],
    });
  });
});

describe('monitoring: saldo, consumo, ubicación, referencia y nombre del cliente', () => {
  it('tapa saldo, gastado_hoy, lat, lng, referencia y nombre_cliente en cualquier forma de la llave', () => {
    const b = crumb({
      category: 'fetch',
      message: 'GET /v1/wallets/me 200',
      data: {
        respuesta: { saldo: 350.5, gastado_hoy: 42, moneda: 'MXN' },
        entrega: { lat: 19.4326, lng: -99.1332, referencia: 'Portón azul junto a la tienda', zona: 'centro' },
        pedido: { id: 7, nombre_cliente: 'Ana López', total: 120 },
        camel: { gastadoHoy: 10, nombreCliente: 'Luis', Saldo: '80.00', LAT: '19.1', 'LNG': '-99.2' },
      },
    });
    expect(b?.data).toEqual({
      respuesta: { saldo: '[Filtered]', gastado_hoy: '[Filtered]', moneda: 'MXN' },
      entrega: { lat: '[Filtered]', lng: '[Filtered]', referencia: '[Filtered]', zona: 'centro' },
      pedido: { id: 7, nombre_cliente: '[Filtered]', total: 120 },
      camel: {
        gastadoHoy: '[Filtered]',
        nombreCliente: '[Filtered]',
        Saldo: '[Filtered]',
        LAT: '[Filtered]',
        LNG: '[Filtered]',
      },
    });
  });

  it('tapa esas llaves en extra, contexts, JSON en texto y query_string del evento', () => {
    const out = send({
      extra: { cartera: { hijo: { saldo: 50, gastado_hoy: 15 } } },
      contexts: { domicilio: { lat: 20.6597, lng: -103.3496 } },
      breadcrumbs: [{ category: 'xhr', data: { body: JSON.stringify({ referencia: 'Casa blanca', nombre_cliente: 'Ana' }) } }],
      request: { url: 'https://vaiinilla.app/a', query_string: { lat: '19.4', lng: '-99.1', mesa: '4' } },
    });
    expect(out.extra).toEqual({ cartera: { hijo: { saldo: '[Filtered]', gastado_hoy: '[Filtered]' } } });
    expect(out.contexts).toEqual({ domicilio: { lat: '[Filtered]', lng: '[Filtered]' } });
    expect(out.breadcrumbs?.[0]?.data).toEqual({
      body: JSON.stringify({ referencia: '[Filtered]', nombre_cliente: '[Filtered]' }),
    });
    expect(out.request?.query_string).toEqual({ lat: '[Filtered]', lng: '[Filtered]', mesa: '4' });
    expect(JSON.stringify(out)).not.toMatch(/20\.6597|Casa blanca|"Ana"/);
  });
});

describe('monitoring: alérgenos, notas, hotel, modo papás y llaves con secret', () => {
  it('(a) tapa alergenos, notas y notas_cocina, también con acentos y mayúsculas', () => {
    const b = crumb({
      category: 'fetch',
      data: {
        pedido: { id: 3, alergenos: ['cacahuate'], notas: 'Sin gluten, es para Luis', notas_cocina: 'Alergia al huevo', total: 90 },
        perfil: { 'Alérgenos': 'nuez', notasCocina: 'sin lácteos', 'NOTAS': 'x' },
      },
    });
    expect(b?.data).toEqual({
      pedido: { id: 3, alergenos: '[Filtered]', notas: '[Filtered]', notas_cocina: '[Filtered]', total: 90 },
      perfil: { 'Alérgenos': '[Filtered]', notasCocina: '[Filtered]', NOTAS: '[Filtered]' },
    });
  });

  it('(b) tapa cualquier llave con "secret" en extra, contexts y un cuerpo parseado', () => {
    const out = send({
      extra: { stripe: { payment_intent_client_secret: 'pi_1_secret_2', payment_intent: 'pi_1' } },
      contexts: { pago: { setupIntentClientSecret: 'seti_1_secret_3', webhookSecret: 'w', estado: 'ok' } },
      breadcrumbs: [
        {
          category: 'fetch',
          data: { body: JSON.stringify({ client_secret: 'pi_9_secret_8', clientSecretRecarga: 'r', monto: 100 }) },
        },
      ],
    });
    expect(out.extra).toEqual({ stripe: { payment_intent_client_secret: '[Filtered]', payment_intent: 'pi_1' } });
    expect(out.contexts).toEqual({
      pago: { setupIntentClientSecret: '[Filtered]', webhookSecret: '[Filtered]', estado: 'ok' },
    });
    expect(out.breadcrumbs?.[0]?.data).toEqual({
      body: JSON.stringify({ client_secret: '[Filtered]', clientSecretRecarga: '[Filtered]', monto: 100 }),
    });
    expect(redactString('fallo {"payment_intent_client_secret":"pi_5_secret_6", "x":1')).toBe(
      'fallo {"payment_intent_client_secret":"[Filtered]", "x":1',
    );
    expect(JSON.stringify(out)).not.toMatch(/_secret_/);
  });

  it('(c) tapa huesped, tarifa_noche y total_cobrado del hotel, también con acento', () => {
    const out = send({
      extra: {
        reserva: { id: 'r1', huesped: 'Ana López', tarifa_noche: 1450, total_cobrado: 4350, noches: 3 },
        otra: { 'Huésped': { nombre: 'Luis' }, tarifaNoche: '900.00', TotalCobrado: 900 },
      },
    });
    expect(out.extra).toEqual({
      reserva: { id: 'r1', huesped: '[Filtered]', tarifa_noche: '[Filtered]', total_cobrado: '[Filtered]', noches: 3 },
      otra: { 'Huésped': '[Filtered]', tarifaNoche: '[Filtered]', TotalCobrado: '[Filtered]' },
    });
  });

  it('(d) tapa disponible_hoy, limite_diario y umbral_saldo_bajo del modo papás, también con acento', () => {
    const b = crumb({
      category: 'fetch',
      data: {
        hijo: { id: 'hijo-1', disponible_hoy: 35, limite_diario: 80, umbral_saldo_bajo: 50, activo: true },
        controles: { disponibleHoy: '10', 'límite_diario': 60, UmbralSaldoBajo: 20 },
      },
    });
    expect(b?.data).toEqual({
      hijo: { id: 'hijo-1', disponible_hoy: '[Filtered]', limite_diario: '[Filtered]', umbral_saldo_bajo: '[Filtered]', activo: true },
      controles: { disponibleHoy: '[Filtered]', 'límite_diario': '[Filtered]', UmbralSaldoBajo: '[Filtered]' },
    });
  });
});

describe('monitoring: mensajes del asistente de pedidos (mensaje, texto, content y prompt)', () => {
  it('tapa mensaje, texto, content y prompt en extra y contexts del evento', () => {
    const out = send({
      extra: {
        asistente: {
          peticion: { mensajes: [{ rol: 'cliente', texto: 'Soy Ana, alérgica a la nuez' }, { rol: 'asistente', Texto: 'Ok' }] },
          respuesta: { mensaje: 'Ana, te recomiendo el bowl', quedan_mensajes: 38 },
        },
      },
      contexts: { llm: { prompt: 'Cliente: Luis, mesa 4', content: 'respuesta libre', modelo: 'x' }, otra: { Mensaje: 'hola' } },
    });
    expect(out.extra).toEqual({
      asistente: {
        peticion: { mensajes: [{ rol: 'cliente', texto: '[Filtered]' }, { rol: 'asistente', Texto: '[Filtered]' }] },
        respuesta: { mensaje: '[Filtered]', quedan_mensajes: 38 },
      },
    });
    expect(out.contexts).toEqual({
      llm: { prompt: '[Filtered]', content: '[Filtered]', modelo: 'x' },
      otra: { Mensaje: '[Filtered]' },
    });
    expect(JSON.stringify(out)).not.toMatch(/Ana|Luis|nuez|bowl/);
  });

  it('tapa mensaje, texto, content y prompt en el data de breadcrumbs fetch y xhr', () => {
    const fetchCrumb = crumb({
      category: 'fetch',
      data: {
        method: 'POST',
        url: 'https://api.vaiinilla.app/v1/asistente-cliente',
        status_code: 200,
        request_body: { mensajes: [{ rol: 'cliente', texto: 'Quiero algo sin gluten para Luis' }] },
        response_body: JSON.stringify({ data: { mensaje: 'Luis, te sugiero...', quedan_mensajes: 39 } }),
      },
    });
    expect(fetchCrumb?.data).toEqual({
      method: 'POST',
      url: 'https://api.vaiinilla.app/v1/asistente-cliente',
      status_code: 200,
      request_body: { mensajes: [{ rol: 'cliente', texto: '[Filtered]' }] },
      response_body: JSON.stringify({ data: { mensaje: '[Filtered]', quedan_mensajes: 39 } }),
    });

    const xhrCrumb = crumb({
      category: 'xhr',
      data: { method: 'POST', status_code: 500, body: { prompt: 'Cliente Ana', content: 'texto libre', reintento: 1 } },
    });
    expect(xhrCrumb?.data).toEqual({
      method: 'POST',
      status_code: 500,
      body: { prompt: '[Filtered]', content: '[Filtered]', reintento: 1 },
    });
  });
});

describe('monitoring: nota de las líneas del pedido del asistente', () => {
  it('tapa nota en extra y contexts con la forma pedido.lineas[].nota', () => {
    const out = send({
      extra: {
        asistente: {
          pedido: {
            lineas: [
              { producto_id: 'p1', cantidad: 2, nota: 'Sin nuez, Ana es alérgica' },
              { producto_id: 'p2', cantidad: 1, Nota: 'para Luis, mesa 4' },
              { producto_id: 'p3', cantidad: 1, nota: null },
            ],
          },
        },
      },
      contexts: { carrito: { linea: { nota: 'Llamar al 5512345678', producto_id: 'p4' } } },
    });
    expect(out.extra).toEqual({
      asistente: {
        pedido: {
          lineas: [
            { producto_id: 'p1', cantidad: 2, nota: '[Filtered]' },
            { producto_id: 'p2', cantidad: 1, Nota: '[Filtered]' },
            { producto_id: 'p3', cantidad: 1, nota: null },
          ],
        },
      },
    });
    expect(out.contexts).toEqual({ carrito: { linea: { nota: '[Filtered]', producto_id: 'p4' } } });
    expect(JSON.stringify(out)).not.toMatch(/Ana|Luis|nuez|5512345678/);
  });

  it('tapa nota en el data de breadcrumbs fetch y xhr', () => {
    const fetchCrumb = crumb({
      category: 'fetch',
      data: {
        method: 'POST',
        url: 'https://api.vaiinilla.app/v1/asistente-cliente',
        status_code: 200,
        response_body: JSON.stringify({ data: { pedido: { lineas: [{ producto_id: 'p1', cantidad: 1, nota: 'Sin gluten' }] } } }),
      },
    });
    expect(fetchCrumb?.data).toEqual({
      method: 'POST',
      url: 'https://api.vaiinilla.app/v1/asistente-cliente',
      status_code: 200,
      response_body: JSON.stringify({ data: { pedido: { lineas: [{ producto_id: 'p1', cantidad: 1, nota: '[Filtered]' }] } } }),
    });

    const xhrCrumb = crumb({
      category: 'xhr',
      data: { method: 'POST', status_code: 422, body: { lineas: [{ nota: 'alergia al huevo', cantidad: 3 }] } },
    });
    expect(xhrCrumb?.data).toEqual({
      method: 'POST',
      status_code: 422,
      body: { lineas: [{ nota: '[Filtered]', cantidad: 3 }] },
    });
  });
});

describe('monitoring: llaves del chat dentro de JSON incompleto en texto', () => {
  it('tapa mensaje, texto, content, prompt y nota en un JSON cortado o mezclado con texto', () => {
    expect(
      redactString(
        'fallo al parsear {"mensaje":"Hola Ana", "texto":"soy Luis", "content":"libre", "Prompt":"mesa 4", "nota":"sin nuez", "cantidad":2',
      ),
    ).toBe(
      'fallo al parsear {"mensaje":"[Filtered]", "texto":"[Filtered]", "content":"[Filtered]", "Prompt":"[Filtered]", "nota":"[Filtered]", "cantidad":2',
    );
    // Comillas escapadas dentro del valor tampoco dejan pasar el resto.
    expect(redactString('cuerpo: {"nota":"dijo \\"sin nuez\\" para Ana","id":1')).toBe('cuerpo: {"nota":"[Filtered]","id":1');
    // Llaves parecidas que no son del chat no se tocan.
    expect(redactString('{"notario":"x", "contenido_id":"c1"')).toBe('{"notario":"x", "contenido_id":"c1"');
  });

  it('el breadcrumb de console con JSON cortado del asistente sale sin el texto del cliente', () => {
    const b = crumb({ category: 'console', message: 'respuesta parcial {"data":{"mensaje":"Ana, te sugiero el bowl","quedan' });
    expect(b?.message).toBe('respuesta parcial {"data":{"mensaje":"[Filtered]","quedan');
  });
});

describe('monitoring: llaves del asistente en español e inglés (detalle, opciones, nombre, text, note, notes, message)', () => {
  const NEW_KEYS = ['detalle', 'opciones', 'nombre', 'text', 'note', 'notes', 'message'] as const;

  it.each(NEW_KEYS)('tapa "%s" en extra, contexts y el data de un breadcrumb, en cualquier forma de la llave', (key) => {
    const upper = key.toUpperCase();
    const capital = key.charAt(0).toUpperCase() + key.slice(1);
    const out = send({
      extra: { asistente: { [key]: 'Soy Ana, alérgica a la nuez', [`_${upper}-`]: 'mesa 4 de Luis', otro: 'ok' } },
      contexts: { chat: { lista: [{ [capital]: ['Ana', 'Luis'] }] } },
    });
    expect(out.extra).toEqual({ asistente: { [key]: '[Filtered]', [`_${upper}-`]: '[Filtered]', otro: 'ok' } });
    expect(out.contexts).toEqual({ chat: { lista: [{ [capital]: '[Filtered]' }] } });
    const b = crumb({ category: 'fetch', data: { response_body: JSON.stringify({ data: { [key]: 'Ana' } }), status_code: 200 } });
    expect(b?.data).toEqual({ response_body: JSON.stringify({ data: { [key]: '[Filtered]' } }), status_code: 200 });
    expect(JSON.stringify(out)).not.toMatch(/Ana|Luis|nuez/);
  });

  it.each(NEW_KEYS)('tapa "%s" dentro de un JSON cortado en texto', (key) => {
    expect(redactString(`fallo {"${key}":"Ana \\"sin nuez\\"","id":1`)).toBe(`fallo {"${key}":"[Filtered]","id":1`);
  });

  it('tapa las formas reales del asistente: llamar_mesero.detalle, opciones, nombre del invitado, turnos y carrito', () => {
    const out = send({
      extra: {
        respuesta: {
          mensaje: 'Listo',
          llamar_mesero: { motivo: 'otro', detalle: 'Ana necesita silla para bebé' },
          opciones: [{ id: 1, etiqueta: 'Sin nuez' }],
        },
        invitado: { nombre: 'Luis Pérez' },
        turnos: [{ fromCustomer: true, text: 'soy Luis, mesa 4' }],
        respuestaParseada: { message: 'Luis, te sugiero el bowl' },
        linea: { productId: 7, quantity: 1, note: 'alergia al huevo' },
        carrito: { updates: [{ productId: 7, optionIds: [], notes: 'para Ana', quantity: 2 }] },
      },
    });
    expect(out.extra).toEqual({
      respuesta: { mensaje: '[Filtered]', llamar_mesero: { motivo: 'otro', detalle: '[Filtered]' }, opciones: '[Filtered]' },
      invitado: { nombre: '[Filtered]' },
      turnos: [{ fromCustomer: true, text: '[Filtered]' }],
      respuestaParseada: { message: '[Filtered]' },
      linea: { productId: 7, quantity: 1, note: '[Filtered]' },
      carrito: { updates: [{ productId: 7, optionIds: [], notes: '[Filtered]', quantity: 2 }] },
    });
    expect(JSON.stringify(out)).not.toMatch(/Ana|Luis|huevo|bebé|nuez|bowl/);
  });

  it('no tapa llaves parecidas que no están en la lista (la coincidencia es exacta, no por substring)', () => {
    const similar = {
      detalles: 'a',
      detalle_id: 'b',
      opcion: 'c',
      opciones_ids: 'd',
      nombres: 'e',
      nombre_producto: 'f',
      sobrenombre: 'g',
      texts: 'h',
      context: 'i',
      textColor: 'j',
      notebook: 'k',
      noted: 'l',
      footnote: 'm',
      messages: 'n',
      messageId: 'o',
      errorMessage: 'p',
    };
    const out = send({ extra: { ...similar } });
    expect(out.extra).toEqual(similar);
    expect(crumb({ category: 'ui', data: { ...similar } })?.data).toEqual(similar);
    const text = '{"detalles":"a", "nombre_producto":"f", "texts":"h", "noted":"l", "messages":"n", "errorMessage":"p"';
    expect(redactString(text)).toBe(text);
  });

  it('message y text de nivel superior del evento siguen saliendo (solo se limpian como texto)', () => {
    const out = send({ message: 'Error de red', breadcrumbs: [{ category: 'console', message: 'GET /v1/menu 500' }] });
    expect(out.message).toBe('Error de red');
    expect(out.breadcrumbs?.[0]?.message).toBe('GET /v1/menu 500');
  });
});

describe('monitoring: stack traces y request.env', () => {
  it('limpia filename, abs_path, vars y código de los frames de excepciones y threads, y request.env', () => {
    const frame = (url: string) => ({
      filename: url,
      abs_path: url,
      function: 'cargarMesa',
      lineno: 12,
      colno: 4,
      in_app: true,
      vars: { token: 'abc', mesa: 4, correo: 'ana@correo.mx' },
      context_line: `fetch('/v1/x', { headers: { Authorization: 'Bearer ${JWT}' } })`,
      pre_context: [`const t = '${VILLO}';`],
      post_context: ['return null;'],
    });
    const out = send({
      exception: {
        values: [
          {
            type: 'TypeError',
            value: 'x is undefined',
            stacktrace: {
              frames: [
                frame('https://vaiinilla.app/e/cafe/m/AbC123xyz?token=t1'),
                frame('https://vaiinilla.app/assets/index-a1b2c3.js'),
              ],
            },
          },
        ],
      },
      threads: { values: [{ id: 1, stacktrace: { frames: [frame(`https://vaiinilla.app/seguimiento/tok_9?id_token=${JWT}`)] } }] },
      request: { url: 'https://vaiinilla.app/', env: { REMOTE_ADDR: '10.0.0.1', referer: '/u/123?email=a@b.mx' } },
    });
    const frames = out.exception?.values?.[0]?.stacktrace?.frames;
    expect(frames?.[0]).toMatchObject({
      filename: 'https://vaiinilla.app/e/cafe/m/[Filtered]?token=[Filtered]',
      abs_path: 'https://vaiinilla.app/e/cafe/m/[Filtered]?token=[Filtered]',
      function: 'cargarMesa',
      lineno: 12,
      vars: { token: '[Filtered]', mesa: 4, correo: '[Filtered]' },
      context_line: "fetch('/v1/x', { headers: { Authorization: 'Bearer [Filtered]' } })",
      pre_context: ["const t = '[Filtered]';"],
      post_context: ['return null;'],
    });
    // Los archivos del build no cambian, para que Sentry siga encontrando los source maps.
    expect(frames?.[1]?.filename).toBe('https://vaiinilla.app/assets/index-a1b2c3.js');
    expect(frames?.[1]?.abs_path).toBe('https://vaiinilla.app/assets/index-a1b2c3.js');
    expect(out.threads?.values?.[0]?.stacktrace?.frames?.[0]?.filename).toBe(
      'https://vaiinilla.app/seguimiento/[Filtered]?id_token=[Filtered]',
    );
    expect(out.request?.env).toEqual({ REMOTE_ADDR: '10.0.0.1', referer: '/u/[Filtered]?email=[Filtered]' });
    expect(JSON.stringify(out)).not.toMatch(/AbC123xyz|t1|tok_9|eyJ|villo_3q2|ana@/);
  });
});

describe('monitoring: teléfonos y compatibilidad con Safari', () => {
  it('tapa teléfonos al inicio, en medio y seguidos, y respeta números que no son teléfono', () => {
    expect(redactString('5512345678')).toBe('[telefono]');
    expect(redactString('tel:5512345678 o (+52 55-1234-5678)')).toBe('tel:[telefono] o ([telefono])');
    expect(redactString('5512345678 5598765432')).toBe('[telefono] [telefono]');
    expect(redactString('pedido 12345, ts 1731234567890, v1.2.5512345678, id a5512345678')).toBe(
      'pedido 12345, ts 1731234567890, v1.2.5512345678, id a5512345678',
    );
  });

  it('no usa lookbehind en las expresiones regulares (Safari < 16.4 da SyntaxError al cargar el módulo)', () => {
    expect(monitoringSource).not.toMatch(/\(\?<[=!]/);
  });
});

describe('monitoring: sin datos sensibles no cambia nada', () => {
  it('conserva breadcrumbs y eventos limpios tal cual', () => {
    const data = {
      url: 'https://api.vaiinilla.app/v1/pedidos?page=2&marketing=1',
      host: 'api.vaiinilla.app',
      version: '1.2.10',
      ruta: '/e/cafe-central/carrito',
      pedido: { id: 9, items: [{ sku: 'B2', cantidad: 3 }], total: 99.5, pagado: false, nota: null },
      monto: '1234.50',
      timestamp: 1731234567890,
    };
    const original = structuredClone(data);
    expect(crumb({ category: 'fetch', message: 'GET /v1/pedidos 200', data })).toEqual({
      category: 'fetch',
      message: 'GET /v1/pedidos 200',
      data: original,
    });
    expect(send({ message: 'Error de red', extra: { pedido: { id: 1, mesa: '4' } } })).toEqual({
      message: 'Error de red',
      extra: { pedido: { id: 1, mesa: '4' } },
    });
  });
});
