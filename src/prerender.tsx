// Entrada del build SSR (vite build --ssr): scripts/prerender.mjs la usa para escribir el HTML
// inicial de las rutas públicas. En el navegador main.tsx monta con createRoot y reemplaza este
// marcado, así que no hay hidratación que tenga que coincidir con el estado del cliente.
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { AppRoutes } from './app/router';
import { AuthProvider } from './context/auth-context';
import { BuyerSessionProvider } from './context/buyer-session';
import { CartProvider } from './context/cart-context';
import { ThemeProvider } from './context/theme-context';

export { applyMetaToHtml, metaForPath } from './lib/seo';

/**
 * Sin VITE_STAFF_APP_URL los enlaces al panel caen en el respaldo de env.ts (app.vaiinilla.app en
 * builds production). Ese respaldo es un diagnóstico del bundle, no contenido: el prerender no lo
 * escribe en el HTML y deja esas rutas solo con su head.
 */
export const staffAppUrlConfigured = Boolean(import.meta.env.VITE_STAFF_APP_URL?.trim());

export function render(url: string): string {
  return renderToString(
    <StrictMode>
      <ThemeProvider>
        <AuthProvider>
          <BuyerSessionProvider>
            <CartProvider>
              <StaticRouter location={url}>
                <AppRoutes />
              </StaticRouter>
            </CartProvider>
          </BuyerSessionProvider>
        </AuthProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}
