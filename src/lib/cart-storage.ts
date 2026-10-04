import type { CartLine } from '../types/api';

const STORAGE_KEY = 'vaiinilla.buyer.cart.v1';

export interface StoredCart {
  slug: string;
  establishmentName: string;
  lines: CartLine[];
}

/** Un carrito olvidado no debe reaparecer al día siguiente. */
const CART_TTL_MS = 12 * 60 * 60 * 1000;

interface StoredCartEnvelope extends StoredCart {
  guardadoEn?: number;
}

// En el dispositivo y no en la pestaña: el teléfono puede cerrar la app instalada al ir a
// Google a entrar, y lo que el cliente ya eligió (con su mesa) debe seguir ahí al volver.
export function readCart(): StoredCart | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { guardadoEn, ...parsed } = JSON.parse(raw) as StoredCartEnvelope;
    if (!parsed.slug || !Array.isArray(parsed.lines)) return null;
    if (guardadoEn !== undefined && Date.now() - guardadoEn > CART_TTL_MS) {
      clearCart();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeCart(cart: StoredCart): void {
  const envelope: StoredCartEnvelope = { ...cart, guardadoEn: Date.now() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  }
}

export function clearCart(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // nada que borrar
  }
}
