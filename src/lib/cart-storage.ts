import type { CartLine } from '../types/api';

const STORAGE_KEY = 'vaiinilla.buyer.cart.v1';

export interface StoredCart {
  slug: string;
  establishmentName: string;
  lines: CartLine[];
}

export function readCart(): StoredCart | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCart;
    if (!parsed.slug || !Array.isArray(parsed.lines)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCart(cart: StoredCart): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
}

export function clearCart(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
