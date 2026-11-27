// @vitest-environment node
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from './prerender';

// En el build real Firebase está configurado y la sesión no está lista al prerenderizar.
vi.mock('./context/auth-context', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({ user: null, ready: false, configured: true, signOut: vi.fn() }),
}));

// Lo que scripts/prerender.mjs escribe en el <div id="root"> de dist/pedir/index.html.
describe('prerender', () => {
  it('/pedir sale con su h1, el texto de cómo funciona y enlaces a / y /soporte', () => {
    const html = render('/pedir');
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*>Pide y recoge sin filas en Chihuahua<\/h1>/);
    expect(html).toContain('Cómo funciona');
    expect(html).toContain('href="/soporte"');
    expect(html).toContain('href="/"');
  });

});
