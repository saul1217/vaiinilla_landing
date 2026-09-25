import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const developmentApiOrigin = 'https://vaiinillaback-development.up.railway.app';
const apiProxy = {
  '/api': {
    target: developmentApiOrigin,
    changeOrigin: true,
    secure: true,
  },
};

export default defineConfig({
  plugins: [
    react(),
    // Installable buyer app. Updates wait for every tab to close (registerType
    // 'prompt' with no prompt) so a new build never reloads a checkout mid-payment.
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'script-defer',
      includeAssets: ['icons/favicon-64.png', 'icons/icon-180.png', 'brand/vaiinilla-mark.png'],
      manifest: {
        id: '/pedir',
        name: 'Vaiinilla',
        short_name: 'Vaiinilla',
        description: 'Pide, sigue tu pedido y paga desde un solo lugar.',
        lang: 'es-MX',
        start_url: '/pedir',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F4F1E7',
        theme_color: '#F4F1E7',
        categories: ['food', 'shopping'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Mis pedidos', url: '/cuenta/pedidos', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Cartera', url: '/cuenta/saldo', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        // App shell only. API, Stripe and Firebase always go to the network.
        globPatterns: ['**/*.{js,css,html,woff2}', 'icons/*.png', 'brand/*.png'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/\.well-known\//, /^\/__/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: ({ request, sameOrigin }) => sameOrigin && request.destination === 'image',
            handler: 'CacheFirst',
            options: { cacheName: 'images', expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: apiProxy,
  },
  preview: {
    proxy: apiProxy,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: true,
    env: {
      VITE_API_URL: 'https://vaiinillaback-development.up.railway.app/api/v1',
    },
  },
});
