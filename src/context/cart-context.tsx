/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CartLine, CatalogProduct } from '../types/api';
import { cartLineKey, previewForProduct } from '../lib/cart';
import { clearCart, readCart, writeCart, type StoredCart } from '../lib/cart-storage';

interface CartContextValue {
  cart: StoredCart | null;
  addLine: (
    slug: string,
    establishmentName: string,
    product: CatalogProduct,
    optionIds: number[],
    quantity: number,
    notes?: string,
  ) => void;
  updateQuantity: (productId: number, optionIds: number[], quantity: number, notes?: string) => void;
  removeLine: (productId: number, optionIds: number[], notes?: string) => void;
  reset: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function sameLine(line: CartLine, productId: number, optionIds: number[], notes = ''): boolean {
  return cartLineKey(line.productId, line.optionIds, line.notes ?? '') === cartLineKey(productId, optionIds, notes);
}

/** Un carrito sin líneas no existe: se borra del dispositivo; si tiene, se guarda tal cual. */
function persistCart(next: StoredCart | null): StoredCart | null {
  const normalized = next && next.lines.length > 0 ? next : null;
  if (normalized) writeCart(normalized);
  else clearCart();
  return normalized;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<StoredCart | null>(() =>
    typeof window === 'undefined' ? null : readCart(),
  );

  const commit = useCallback((next: StoredCart | null) => {
    setCart(persistCart(next));
  }, []);

  const addLine = useCallback(
    (
      slug: string,
      establishmentName: string,
      product: CatalogProduct,
      optionIds: number[],
      quantity: number,
      notes?: string,
    ) => {
      const preview = previewForProduct(product, optionIds, 1);
      if (!preview) throw new Error('No se pudo calcular el precio de vista previa.');
      const cleanNotes = notes?.trim() || undefined;
      const incoming: CartLine = {
        productId: product.id,
        quantity,
        optionIds,
        productName: product.nombre,
        notes: cleanNotes,
        unitPreview: preview.unit,
        unitCounter: preview.counterUnit,
        imageUrl: product.imagen_url,
      };
      setCart((current) => {
        const base: StoredCart =
          current && current.slug === slug ? current : { slug, establishmentName, lines: [] };
        const existing = base.lines.find((line) => sameLine(line, product.id, optionIds, cleanNotes));
        const lines = existing
          ? base.lines.map((line) =>
              sameLine(line, product.id, optionIds, cleanNotes)
                ? { ...line, quantity: Math.min(20, line.quantity + quantity) }
                : line,
            )
          : [...base.lines, incoming];
        return persistCart({ slug, establishmentName, lines });
      });
    },
    [],
  );

  const updateQuantity = useCallback((productId: number, optionIds: number[], quantity: number, notes?: string) => {
    setCart((current) => {
      if (!current) return current;
      const cleanNotes = notes?.trim() || undefined;
      const lines =
        quantity < 1
          ? current.lines.filter((line) => !sameLine(line, productId, optionIds, cleanNotes))
          : current.lines.map((line) =>
              sameLine(line, productId, optionIds, cleanNotes)
                ? { ...line, quantity: Math.min(20, quantity) }
                : line,
            );
      return persistCart({ ...current, lines });
    });
  }, []);

  const removeLine = useCallback((productId: number, optionIds: number[], notes?: string) => {
    setCart((current) => {
      if (!current) return current;
      const cleanNotes = notes?.trim() || undefined;
      const lines = current.lines.filter((line) => !sameLine(line, productId, optionIds, cleanNotes));
      return persistCart({ ...current, lines });
    });
  }, []);

  const reset = useCallback(() => commit(null), [commit]);

  const value = useMemo(
    () => ({ cart, addLine, updateQuantity, removeLine, reset }),
    [addLine, cart, removeLine, reset, updateQuantity],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart debe usarse dentro de CartProvider.');
  return context;
}
