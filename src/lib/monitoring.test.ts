import { describe, expect, it } from 'vitest';
import type { Breadcrumb, ErrorEvent } from '@sentry/react';
import { beforeBreadcrumb, beforeSend, redactString, scrubUrl } from './monitoring';

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
    expect(out.extra).toEqual({ modoPapas: { hijo: { id: 'hijo-1', token: '[Filtered]', nombre: 'Luis' } } });
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
