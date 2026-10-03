import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { clearResourceCache } from '../lib/resource-cache';

// El flujo de invitado persiste en localStorage. En este entorno jsdom expone
// sessionStorage pero deja window.localStorage roto: las pruebas usan un
// almacenamiento en memoria cuando el nativo no sirve (solo pruebas).
function ensureLocalStorage() {
  try {
    if (typeof window.localStorage?.getItem === 'function') {
      window.localStorage.clear();
      return;
    }
  } catch {
    // roto: se reemplaza abajo
  }
  const area = new Map<string, string>();
  const shim: Storage = {
    get length() {
      return area.size;
    },
    clear: () => area.clear(),
    getItem: (key: string) => (area.has(key) ? area.get(key)! : null),
    key: (index: number) => [...area.keys()][index] ?? null,
    removeItem: (key: string) => {
      area.delete(key);
    },
    setItem: (key: string, value: string) => {
      area.set(key, String(value));
    },
  };
  Object.defineProperty(window, 'localStorage', {
    writable: true,
    configurable: true,
    value: shim,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    writable: true,
    configurable: true,
    value: shim,
  });
}

ensureLocalStorage();

class IntersectionObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

Object.defineProperty(globalThis, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: IntersectionObserverMock,
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

afterEach(() => cleanup());

// La memoria de datos del dock es global: cada prueba empieza sin datos guardados.
afterEach(() => clearResourceCache());
