import type { CartLine, CatalogProduct, CreateOrderInput, CreateOrderItemInput, OrderDestination, PaymentMethod } from '../types/api';
import { cartPreview, centsToMoney, linePreview, moneyToCents, productUnitPreview } from './money';

export function optionExtraPrices(product: CatalogProduct, optionIds: number[]): string[] {
  return product.grupos_opcion
    .flatMap((group) => group.opciones)
    .filter((option) => optionIds.includes(option.id))
    .map((option) => option.precio_extra);
}

export function validateSelections(product: CatalogProduct, optionIds: number[]): string | null {
  const allIds = new Set(
    product.grupos_opcion.flatMap((group) => group.opciones.map((option) => option.id)),
  );
  if (optionIds.some((id) => !allIds.has(id))) {
    return 'Hay una opción que no pertenece a este producto.';
  }
  if (new Set(optionIds).size !== optionIds.length) {
    return 'No se pueden repetir opciones.';
  }
  for (const group of product.grupos_opcion) {
    const count = group.opciones.filter((option) => optionIds.includes(option.id)).length;
    if (count < group.min_selecciones || count > group.max_selecciones) {
      return `${group.nombre}: elige entre ${group.min_selecciones} y ${group.max_selecciones}.`;
    }
  }
  return null;
}

export function defaultOptionIds(product: CatalogProduct): number[] {
  const selected: number[] = [];
  for (const group of product.grupos_opcion) {
    if (group.min_selecciones === 1 && group.max_selecciones === 1 && group.opciones[0]) {
      selected.push(group.opciones[0].id);
    }
  }
  return selected;
}

export function cartLineKey(productId: number, optionIds: number[], notes = ''): string {
  const norm = notes.trim().toLowerCase();
  return `${productId}:${[...optionIds].sort((a, b) => a - b).join(',')}:${norm}`;
}

export function previewForProduct(product: CatalogProduct, optionIds: number[], quantity: number) {
  const extras = optionExtraPrices(product, optionIds);
  const unit = productUnitPreview(product.precio_digital, extras);
  const counterUnit = productUnitPreview(product.precio_mostrador, extras) ?? unit;
  if (!unit || !counterUnit) return null;
  const line = linePreview(unit, quantity);
  if (!line) return null;
  return { unit, line, counterUnit };
}

/** El precio unitario que de verdad se cobra: solo la tarjeta lleva la comisión. */
export function unitFor(line: CartLine, method: PaymentMethod | null): string {
  return method === 'stripe' ? line.unitPreview : (line.unitCounter ?? line.unitPreview);
}

/** Total según el método; sin método elegido, el de mostrador (efectivo es el predeterminado). */
export function cartTotal(lines: CartLine[], method: PaymentMethod | null = null): string | null {
  const totals: string[] = [];
  for (const line of lines) {
    const total = linePreview(unitFor(line, method), line.quantity);
    if (!total) return null;
    totals.push(total);
  }
  return cartPreview(totals);
}

/**
 * Comisión por tarjeta: lo que sube el total frente a mostrador. Null si no hay
 * diferencia o no se puede calcular: no hay nada que desglosar.
 */
export function cardFee(lines: CartLine[]): string | null {
  const cash = cartTotal(lines, 'efectivo');
  const card = cartTotal(lines, 'stripe');
  if (!cash || !card) return null;
  const cashCents = moneyToCents(cash);
  const cardCents = moneyToCents(card);
  if (cashCents === null || cardCents === null) return null;
  const fee = cardCents - cashCents;
  return fee > 0n ? centsToMoney(fee) : null;
}

export function toCreateOrderInput(
  lines: CartLine[],
  paymentMethod: PaymentMethod,
  kitchenNotes: string,
  destination: OrderDestination = 'para_llevar',
  spaceId: number | null = null,
  payAtEnd = false,
  tableSessionId?: string | null,
): CreateOrderInput {
  if (lines.length < 1 || lines.length > 50) {
    throw new Error('El pedido debe contener entre 1 y 50 líneas.');
  }
  if (destination === 'en_espacio' && spaceId == null) {
    throw new Error('Falta la mesa para pedir en el espacio.');
  }
  if (payAtEnd && (destination !== 'en_espacio' || paymentMethod !== 'efectivo')) {
    throw new Error('Pagar al final solo aplica a un pedido en tu lugar, sin pagar antes.');
  }
  const lineNotesSummary = lines
    .filter((l) => l.notes?.trim())
    .map((l) => `${l.productName}: ${l.notes?.trim()}`)
    .join(' · ');
  const combinedKitchenNotes = [kitchenNotes.trim(), lineNotesSummary].filter(Boolean).join(' | ');

  return {
    metodo_pago: paymentMethod,
    destino: destination,
    espacio_id: destination === 'en_espacio' ? spaceId : null,
    ...(destination === 'en_espacio' && tableSessionId ? { sesion_espacio_id: tableSessionId } : {}),
    notas_cocina: combinedKitchenNotes || null,
    ...(payAtEnd ? { pago_diferido: true } : {}),
    items: lines.map((line) => {
      if (line.quantity < 1 || line.quantity > 20) {
        throw new Error('Cada producto admite entre 1 y 20 piezas.');
      }
      const item: CreateOrderItemInput = {
        producto_id: line.productId,
        cantidad: line.quantity,
        opcion_ids: [...line.optionIds].sort((a, b) => a - b),
      };
      if (line.notes?.trim()) {
        item.notas = line.notes.trim();
      }
      return item;
    }),
  };
}

export function isOperationallyReady(status: {
  recibiendo_pedidos: boolean;
  sesion_caja_abierta: boolean;
  caja_en_linea: boolean;
  cocina_en_linea: boolean;
} | null): boolean {
  if (!status) return false;
  return (
    status.recibiendo_pedidos &&
    status.sesion_caja_abierta &&
    status.caja_en_linea &&
    status.cocina_en_linea
  );
}

/** La política del establecimiento decide si recibe pedidos; las estaciones
 * pueden recuperarse después y no deben bloquear el checkout. */
/** "Pagar al final" se ofrece solo en un lugar (mesa, cancha, asiento) y si el negocio lo permite. */
export function canPayAtEnd(
  status: { permite_pago_al_final?: boolean } | null,
  forHere: boolean,
): boolean {
  return forHere && status?.permite_pago_al_final === true;
}

export function canAcceptOrders(status: { recibiendo_pedidos: boolean } | null): boolean {
  return Boolean(status?.recibiendo_pedidos);
}
