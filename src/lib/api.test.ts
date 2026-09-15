import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { api } from './api';
import { ESTABLISHMENT_CLOSED_MESSAGE } from '../types/api';
import { isOperationallyReady } from './cart';

const baseUrl = api.apiUrl;
const server = setupServer();

const establishment = {
  id: '8246ff44-aad0-4e49-9268-b71c997893fe',
  nombre: 'Cafetería Centro',
  slug: 'cafeteria-centro',
  identificador_cliente_etiqueta: 'Matrícula',
  identificador_cliente_obligatorio: true,
};

const order = {
  id: '3d196e4d-9082-4b5d-aa7a-65f0e21ac654',
  folio: 42,
  fecha_operativa: '2026-08-11',
  estado: 'por_cobrar' as const,
  metodo_pago: 'efectivo' as const,
  destino: 'para_llevar' as const,
  espacio: null,
  subtotal: '26.00',
  ahorro_combinado: '0.00',
  cashback_otorgado: '0.00',
  total: '26.00',
  version: 1,
  creado_en: '2026-08-11T12:00:00Z',
  actualizado_en: '2026-08-11T12:00:00Z',
  notas_cocina: null,
  usuario: { nombre: 'Ana Pérez', matricula: 'A01234' },
  items: [],
};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('buyer API client', () => {
  it('lista establecimientos y catálogo públicos', async () => {
    server.use(
      http.get(`${baseUrl}/publico/establecimientos`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('query')).toBe('centro');
        return HttpResponse.json({ data: [establishment], meta: { cursor: null }, error: null });
      }),
      http.get(`${baseUrl}/publico/establecimientos/cafeteria-centro/catalogo`, () =>
        HttpResponse.json({
          data: { categorias: [{ id: 10, nombre: 'Bebidas', orden: 1 }], productos: [] },
          meta: {},
          error: null,
        }),
      ),
    );
    await expect(api.listEstablishments('centro')).resolves.toMatchObject({
      establishments: [{ slug: 'cafeteria-centro' }],
    });
    await expect(api.getGuestCatalog('cafeteria-centro')).resolves.toMatchObject({
      categorias: [{ nombre: 'Bebidas' }],
    });
  });

  it('abre contexto-cliente, crea pedido con Idempotency-Key y consulta wallet', async () => {
    server.use(
      http.post(`${baseUrl}/sesiones/contexto-cliente`, async ({ request }) => {
        expect(request.headers.get('Authorization')).toBe('Bearer firebase-token');
        expect(request.headers.get('Idempotency-Key')).toBeTruthy();
        await expect(request.json()).resolves.toEqual({
          establecimiento_slug: 'cafeteria-centro',
          identificador_cliente: 'A01234',
        });
        return HttpResponse.json({
          data: {
            access_token: 'jwt-client',
            token_type: 'Bearer',
            expires_in: 3600,
            contexto: {
              usuario_id: 'u1',
              membresia_id: 'm1',
              establecimiento_id: establishment.id,
              rol: 'cliente',
              modo_restringido: null,
            },
          },
          meta: {},
          error: null,
        });
      }),
      http.post(`${baseUrl}/pedidos`, async ({ request }) => {
        expect(request.headers.get('Authorization')).toBe('Bearer jwt-client');
        expect(request.headers.get('Idempotency-Key')).toBe('550e8400-e29b-41d4-a716-446655440000');
        await expect(request.json()).resolves.toMatchObject({
          metodo_pago: 'saldo',
          destino: 'para_llevar',
          espacio_id: null,
        });
        return HttpResponse.json({ data: { ...order, metodo_pago: 'saldo' }, meta: {}, error: null }, { status: 201 });
      }),
      http.get(`${baseUrl}/wallets/me`, ({ request }) => {
        expect(request.headers.get('Authorization')).toBe('Bearer jwt-client');
        return HttpResponse.json({
          data: {
            cliente: { usuario_id: 'u1', nombre: 'Ana Pérez', identificador_cliente: 'A01234' },
            wallet: {
              id: 'w1',
              usuario_id: 'u1',
              establecimiento_id: establishment.id,
              saldo: '125.00',
              actualizado_en: '2026-08-12T12:00:00Z',
            },
            movimientos: [],
          },
          meta: {},
          error: null,
        });
      }),
    );

    const context = await api.createClientContext('firebase-token', 'cafeteria-centro', 'A01234');
    expect(context.access_token).toBe('jwt-client');
    const created = await api.createOrder(
      'jwt-client',
      {
        metodo_pago: 'saldo',
        destino: 'para_llevar',
        espacio_id: null,
        notas_cocina: null,
        items: [{ producto_id: 101, cantidad: 1, opcion_ids: [] }],
      },
      '550e8400-e29b-41d4-a716-446655440000',
    );
    expect(created.metodo_pago).toBe('saldo');
    await expect(api.getMyWallet('jwt-client')).resolves.toMatchObject({
      wallet: { saldo: '125.00' },
    });
  });

  it('bloquea checkout con el mensaje genérico de Android si Caja/Cocina no están listas', () => {
    expect(
      isOperationallyReady({
        recibiendo_pedidos: true,
        sesion_caja_abierta: true,
        caja_en_linea: false,
        cocina_en_linea: true,
      }),
    ).toBe(false);
    expect(ESTABLISHMENT_CLOSED_MESSAGE).toContain('no está abierto');
  });

  it('crea un pedido Stripe sin montos y no abre un segundo PaymentIntent', async () => {
    const stripeOrder = {
      ...order,
      metodo_pago: 'stripe' as const,
      total: '123.60',
      pago: {
        payment_attempt_id: 'attempt-1',
        payment_intent_id: 'pi_test_001',
        stripe_account_id: 'acct_test_001',
        payment_status: 'pendiente_pago',
        client_secret: 'pi_test_001_secret_test',
        publishable_key: 'pk_test_51Vaiinilla',
      },
    };
    let pedidoPosts = 0;
    let stripeRetryPosts = 0;
    server.use(
      http.post(`${baseUrl}/pedidos`, async ({ request }) => {
        pedidoPosts += 1;
        expect(request.headers.get('Idempotency-Key')).toBe('create-key-1');
        const body = (await request.json()) as Record<string, unknown>;
        expect(body).toEqual({
          metodo_pago: 'stripe',
          destino: 'para_llevar',
          espacio_id: null,
          notas_cocina: null,
          items: [{ producto_id: 101, cantidad: 1, opcion_ids: [] }],
        });
        expect(JSON.stringify(body)).not.toContain('"total"');
        expect(JSON.stringify(body)).not.toContain('application_fee');
        return HttpResponse.json({ data: stripeOrder, meta: {}, error: null }, { status: 201 });
      }),
      http.post(`${baseUrl}/pedidos/3d196e4d-9082-4b5d-aa7a-65f0e21ac654/pago/stripe`, async ({ request }) => {
        stripeRetryPosts += 1;
        expect(request.headers.get('Idempotency-Key')).toBe('retry-key-1');
        expect(request.headers.get('Content-Type')).toBeNull();
        expect(await request.text()).toBe('');
        return HttpResponse.json({
          data: { pago: stripeOrder.pago },
          meta: {},
          error: null,
        });
      }),
      http.get(`${baseUrl}/pedidos/3d196e4d-9082-4b5d-aa7a-65f0e21ac654`, () =>
        HttpResponse.json({
          data: {
            ...stripeOrder,
            pago: {
              payment_attempt_id: 'attempt-1',
              payment_intent_id: 'pi_test_001',
              stripe_account_id: 'acct_test_001',
              payment_status: 'pendiente_pago',
            },
          },
          meta: {},
          error: null,
        }),
      ),
    );

    const created = await api.createOrder(
      'jwt-client',
      {
        metodo_pago: 'stripe',
        destino: 'para_llevar',
        espacio_id: null,
        notas_cocina: null,
        items: [{ producto_id: 101, cantidad: 1, opcion_ids: [] }],
      },
      'create-key-1',
    );
    expect(created.total).toBe('123.60');
    expect(created.pago?.client_secret).toBe('pi_test_001_secret_test');
    expect(pedidoPosts).toBe(1);
    expect(stripeRetryPosts).toBe(0);

    const fetched = await api.getOrder('jwt-client', created.id);
    expect(fetched.pago?.payment_status).toBe('pendiente_pago');
    expect(fetched.pago?.client_secret).toBeUndefined();

    const retried = await api.retryStripePayment('jwt-client', created.id, 'retry-key-1');
    expect(retried.payment_intent_id).toBe('pi_test_001');
    expect(stripeRetryPosts).toBe(1);
    expect(pedidoPosts).toBe(1);
  });
});
