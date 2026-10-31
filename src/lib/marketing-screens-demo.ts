import type { CartLine, CatalogProduct, OrderDetail } from '../types/api';
import { QA_PHOTO_TACOS } from './qa-catalog-photos';

/** Presentable demo data for marketing screenshots (?marketing=1 on /__qa routes). */
export const MARKETING_SCREEN_PLACE = 'Café del Jardín';
export const MARKETING_SCREEN_TABLE = 'Mesa 5';

export const MARKETING_PRODUCT_TACOS = 'Tacos de birria';
export const MARKETING_PRODUCT_DRINK = 'Agua de sandía';
export const MARKETING_PRODUCT_POSTRE = 'Flan napolitano';

export const MARKETING_ORDER_PREPARING_ID = 'qa-mkt-11';
export const MARKETING_ORDER_LISTO_ID = 'qa-mkt-12';
export const MARKETING_ORDER_MESA_ID = 'qa-mkt-8';

const BASE_TIME = '2026-09-17T12:00:00Z';

function marketingOrder(overrides: Partial<OrderDetail>): OrderDetail {
  return {
    id: MARKETING_ORDER_PREPARING_ID,
    folio: 11,
    fecha_operativa: '2026-09-17',
    estado: 'preparando',
    metodo_pago: 'stripe',
    destino: 'para_llevar',
    espacio: null,
    subtotal: '85.00',
    ahorro_combinado: '0.00',
    cashback_otorgado: '0.00',
    total: '85.00',
    version: 1,
    creado_en: BASE_TIME,
    actualizado_en: BASE_TIME,
    notas_cocina: null,
    usuario: { nombre: 'Ana', matricula: null },
    items: [
      {
        id: 1,
        producto_id: 284,
        nombre_producto: MARKETING_PRODUCT_TACOS,
        estacion_preparacion: 'cocina',
        cantidad: 1,
        precio_digital_unitario: '85.00',
        subtotal: '85.00',
        opciones: [],
      },
    ],
    pago: {
      payment_attempt_id: 'mkt-pay-1',
      payment_intent_id: 'pi_mkt_1',
      stripe_account_id: 'acct_mkt',
      payment_status: 'confirmado',
    },
    ...overrides,
  };
}

export function isMarketingScreenCapture(params: URLSearchParams): boolean {
  return params.get('marketing') === '1';
}

export function marketingPlaceLine(table = MARKETING_SCREEN_TABLE): string {
  return `${MARKETING_SCREEN_PLACE} · ${table}`;
}

export function marketingCatalogProducts(): CatalogProduct[] {
  return [
    {
      id: 285,
      categoria_id: 1,
      estacion_preparacion: 'caja',
      nombre: MARKETING_PRODUCT_DRINK,
      descripcion: null,
      ingredientes: null,
      alergenos: null,
      tiempo_estimado_min: 4,
      precio_mostrador: '28.00',
      precio_digital: '28.00',
      disponible: true,
      imagen_url: null,
      grupos_opcion: [],
    },
    {
      id: 284,
      categoria_id: 2,
      estacion_preparacion: 'cocina',
      nombre: MARKETING_PRODUCT_TACOS,
      descripcion: null,
      ingredientes: null,
      alergenos: null,
      tiempo_estimado_min: 12,
      precio_mostrador: '85.00',
      precio_digital: '85.00',
      disponible: true,
      imagen_url: QA_PHOTO_TACOS,
      grupos_opcion: [],
    },
  ];
}

export function marketingCartLines(): CartLine[] {
  return [
    {
      productId: 284,
      quantity: 2,
      optionIds: [],
      productName: MARKETING_PRODUCT_TACOS,
      unitPreview: '85.00',
      imageUrl: QA_PHOTO_TACOS,
    },
    {
      productId: 285,
      quantity: 1,
      optionIds: [],
      productName: MARKETING_PRODUCT_DRINK,
      unitPreview: '28.00',
      imageUrl: null,
    },
  ];
}

/** Carrito listo para pagar: 2 tacos + 1 bebida = $198 */
export function marketingCheckoutOrder(): OrderDetail {
  return marketingOrder({
    id: 'qa-mkt-cart',
    folio: 14,
    estado: 'por_cobrar',
    metodo_pago: 'efectivo',
    destino: 'para_llevar',
    subtotal: '198.00',
    total: '198.00',
    pago: null,
    items: [
      {
        id: 1,
        producto_id: 284,
        nombre_producto: MARKETING_PRODUCT_TACOS,
        estacion_preparacion: 'cocina',
        cantidad: 2,
        precio_digital_unitario: '85.00',
        subtotal: '170.00',
        opciones: [],
      },
      {
        id: 2,
        producto_id: 285,
        nombre_producto: MARKETING_PRODUCT_DRINK,
        estacion_preparacion: 'caja',
        cantidad: 1,
        precio_digital_unitario: '28.00',
        subtotal: '28.00',
        opciones: [],
      },
    ],
  });
}

/** Pedido en mesa recién confirmado. */
export function marketingMesaOrder(): OrderDetail {
  return marketingOrder({
    id: MARKETING_ORDER_MESA_ID,
    folio: 8,
    estado: 'cobrado',
    destino: 'en_espacio',
    espacio: { id: 5, nombre: MARKETING_SCREEN_TABLE, tipo: 'mesa' },
    subtotal: '113.00',
    total: '113.00',
    items: [
      {
        id: 1,
        producto_id: 284,
        nombre_producto: MARKETING_PRODUCT_TACOS,
        estacion_preparacion: 'cocina',
        cantidad: 1,
        precio_digital_unitario: '85.00',
        subtotal: '85.00',
        opciones: [],
      },
      {
        id: 2,
        producto_id: 285,
        nombre_producto: MARKETING_PRODUCT_DRINK,
        estacion_preparacion: 'caja',
        cantidad: 1,
        precio_digital_unitario: '28.00',
        subtotal: '28.00',
        opciones: [],
      },
    ],
  });
}

/** Dos pedidos en curso para Mis pedidos (sin tokens de QR). */
export function marketingLiveOrders(): OrderDetail[] {
  return [
    marketingOrder({
      id: MARKETING_ORDER_PREPARING_ID,
      folio: 11,
      estado: 'preparando',
      metodo_pago: 'stripe',
      destino: 'para_llevar',
      total: '85.00',
    }),
    marketingOrder({
      id: MARKETING_ORDER_LISTO_ID,
      folio: 12,
      estado: 'listo',
      metodo_pago: 'efectivo',
      destino: 'para_llevar',
      total: '55.00',
      subtotal: '55.00',
      items: [
        {
          id: 1,
          producto_id: 285,
          nombre_producto: MARKETING_PRODUCT_DRINK,
          estacion_preparacion: 'caja',
          cantidad: 1,
          precio_digital_unitario: '28.00',
          subtotal: '28.00',
          opciones: [],
        },
        {
          id: 2,
          producto_id: 286,
          nombre_producto: MARKETING_PRODUCT_POSTRE,
          estacion_preparacion: 'caja',
          cantidad: 1,
          precio_digital_unitario: '27.00',
          subtotal: '27.00',
          opciones: [],
        },
      ],
      pago: null,
    }),
  ];
}

export function marketingDefaultExpandedOrderId(): string {
  return MARKETING_ORDER_PREPARING_ID;
}
