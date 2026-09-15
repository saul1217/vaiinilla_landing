export type OrderStatus =
  | 'por_cobrar'
  | 'cobrado'
  | 'preparando'
  | 'listo'
  | 'entregado'
  | 'cancelado'
  | 'no_recogido'
  | 'expirado';

export type PaymentMethod = 'stripe' | 'efectivo' | 'saldo';
export type OrderDestination = 'para_llevar' | 'en_espacio';
export type OperationalRole = 'cliente' | 'cajero' | 'cocina' | 'admin' | 'mesero';

export type StripePaymentStatus =
  | 'pendiente_pago'
  | 'processing'
  | 'requires_action'
  | 'confirmado'
  | 'fallido'
  | 'cancelado'
  | 'pendiente_reembolso'
  | 'reembolsando'
  | 'reembolsado';

export interface ApiEnvelope<T> {
  data: T;
  meta: {
    cursor?: string | null;
    [key: string]: unknown;
  };
  error: null;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorEnvelope {
  data: null;
  meta?: Record<string, unknown>;
  error: ApiErrorBody;
}

export interface PublicEstablishment {
  id: string;
  nombre: string;
  slug: string;
  identificador_cliente_etiqueta: string;
  identificador_cliente_obligatorio: boolean;
}

export interface CatalogCategory {
  id: number;
  nombre: string;
  orden: number;
}

export interface CatalogOption {
  id: number;
  nombre: string;
  precio_extra: string;
}

export interface CatalogOptionGroup {
  id: number;
  nombre: string;
  min_selecciones: number;
  max_selecciones: number;
  opciones: CatalogOption[];
}

export interface CatalogProduct {
  id: number;
  categoria_id: number;
  estacion_preparacion: 'cocina' | 'caja';
  nombre: string;
  descripcion: string | null;
  ingredientes: string | null;
  alergenos: string | null;
  tiempo_estimado_min: number;
  precio_mostrador: string;
  precio_digital: string;
  disponible: boolean;
  imagen_url: string | null;
  grupos_opcion: CatalogOptionGroup[];
}

export interface CatalogResponse {
  categorias: CatalogCategory[];
  productos: CatalogProduct[];
}

export interface OperationalStatus {
  recibiendo_pedidos: boolean;
  sesion_caja_abierta: boolean;
  caja_en_linea: boolean;
  cocina_en_linea: boolean;
  tiempo_estimado_min: number | null;
  consultado_en: string;
}

export interface LegalVersions {
  terminos_version: string;
  terminos_url: string;
  privacidad_version: string;
  privacidad_url: string;
}

export interface IdentityRegistrationInput {
  nombre: string;
  terminos_version: string;
  privacidad_version: string;
}

export interface IdentityRegistration {
  usuario: {
    id: string;
    nombre: string;
    email: string;
    email_verificado_en: string | null;
  };
  consentimiento: {
    terminos_version: string;
    privacidad_version: string;
    aceptado_en: string;
  };
}

export interface SessionAccess {
  membresia_id: string;
  establecimiento: {
    id: string;
    nombre: string;
    slug: string;
  };
  rol: OperationalRole;
  identificador_cliente: string | null;
  estado_establecimiento: 'activo' | 'suspendido';
  cierre_operativo_disponible: boolean;
}

export interface ClientContextResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  contexto: {
    usuario_id: string;
    membresia_id: string;
    establecimiento_id: string;
    rol: OperationalRole;
    modo_restringido: null | 'solo_lectura' | 'cierre_operativo';
  };
}

export interface OrderSpace {
  id: number;
  nombre: string;
  tipo: string;
}

export interface OrderItemOption {
  opcion_id: number;
  nombre: string;
  precio_extra: string;
}

export interface OrderItem {
  id: number;
  producto_id: number;
  nombre_producto: string;
  estacion_preparacion: 'cocina' | 'caja';
  cantidad: number;
  precio_digital_unitario: string;
  subtotal: string;
  opciones: OrderItemOption[];
}

export interface OrderDetail {
  id: string;
  folio: number;
  fecha_operativa: string;
  estado: OrderStatus;
  metodo_pago: PaymentMethod;
  destino: OrderDestination;
  espacio: OrderSpace | null;
  subtotal: string;
  ahorro_combinado: string;
  cashback_otorgado: string;
  total: string;
  version: number;
  creado_en: string;
  actualizado_en: string;
  notas_cocina: string | null;
  usuario: {
    nombre: string;
    matricula: string | null;
  } | null;
  items: OrderItem[];
  qr_token?: string | null;
  pago?: OrderPayment | null;
}

export interface OrderPayment {
  payment_attempt_id: string;
  payment_intent_id: string;
  stripe_account_id: string;
  payment_status: StripePaymentStatus;
  client_secret?: string;
  publishable_key?: string;
  currency?: string;
}

export interface CreateOrderItemInput {
  producto_id: number;
  cantidad: number;
  opcion_ids: number[];
}

export interface CreateOrderInput {
  metodo_pago: PaymentMethod;
  destino: OrderDestination;
  espacio_id: number | null;
  notas_cocina: string | null;
  items: CreateOrderItemInput[];
}

export interface StripePaymentSession {
  payment_attempt_id: string;
  payment_intent_id: string;
  client_secret: string;
  stripe_account_id: string;
  publishable_key: string;
  payment_status: StripePaymentStatus;
}

export interface WalletSnapshot {
  id: string | null;
  usuario_id: string | null;
  establecimiento_id: string | null;
  saldo: string;
  actualizado_en: string | null;
}

export interface WalletMovement {
  id: string;
  tipo: string;
  descripcion: string;
  monto: string;
  saldo_posterior: string;
  pedido_id: string | null;
  creado_en: string;
}

export interface WalletData {
  cliente: {
    usuario_id: string;
    nombre: string;
    identificador_cliente: string | null;
  };
  wallet: WalletSnapshot;
  movimientos: WalletMovement[];
}

export interface CartLine {
  productId: number;
  quantity: number;
  optionIds: number[];
  productName: string;
  unitPreview: string;
  imageUrl: string | null;
}

export const STAFF_APP_URL = 'https://app.vaiinilla.app';
export const ESTABLISHMENT_CLOSED_MESSAGE =
  'El establecimiento no está abierto en este momento. Verifica que esté abierto y desliza hacia abajo para actualizar.';
