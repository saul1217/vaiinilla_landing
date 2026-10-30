// Geometría, persistencia y visibilidad del botón flotante "Llamar al mesero".
import { useEffect, useSyncExternalStore } from 'react';

export type FabSide = 'left' | 'right';
export interface FabPosition {
  side: FabSide;
  /** Distancia desde el borde superior de la pantalla, en px. */
  y: number;
}

export const FAB_SIZE = 56;
export const FAB_MARGIN = 12;
/** Movimiento máximo para que un toque cuente como toque y no como arrastre. */
export const TAP_SLOP = 8;

const KEY = 'vaiinilla.buyer.call-fab.v1';

/**
 * Espacio vertical vedado, en espejo con alumno.css: en móvil la barra inferior
 * (84 px con safe-area) y, en el Carrito, además el botón de pagar fijo (12 px de relleno + ~53 px de botón + margen: 216 px, QA-064).
 */
export function fabBounds(viewportHeight: number, opts: { desktop: boolean; cart: boolean }) {
  const reserve = opts.desktop ? 16 : opts.cart ? 216 : 84;
  const top = opts.desktop ? 72 : FAB_MARGIN;
  const bottom = Math.max(top, viewportHeight - reserve - FAB_SIZE);
  return { top, bottom };
}

export function clampY(y: number, bounds: { top: number; bottom: number }): number {
  return Math.min(bounds.bottom, Math.max(bounds.top, y));
}

/** Al soltar, el botón se pega a la orilla cuyo lado contiene su centro. */
export function snapSide(left: number, width: number, viewportWidth: number): FabSide {
  return left + width / 2 < viewportWidth / 2 ? 'left' : 'right';
}

export function readFabPosition(): FabPosition | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FabPosition>;
    if ((parsed.side !== 'left' && parsed.side !== 'right') || !Number.isFinite(parsed.y)) return null;
    return { side: parsed.side, y: parsed.y as number };
  } catch {
    return null;
  }
}

export function writeFabPosition(position: FabPosition): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(position));
  } catch {
    // sin almacenamiento: la posición solo dura la sesión
  }
}

// ---- Superficies de pago que ocultan el botón ----
let hiders = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** Mientras el componente que lo llama esté montado (checkout/pago), el botón se oculta. */
export function useHideFloatingCall(): void {
  useEffect(() => {
    hiders += 1;
    notify();
    return () => {
      hiders -= 1;
      notify();
    };
  }, []);
}

export function useFloatingCallHidden(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => hiders > 0,
    () => false,
  );
}
