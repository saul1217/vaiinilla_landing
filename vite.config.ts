import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const developmentApiOrigin = 'https://vaiinillaback-development.up.railway.app';
const apiProxy = {
  '/api': {
    target: developmentApiOrigin,
    changeOrigin: true,
    secure: true,
  },
};

export default defineConfig({
  plugins: [react()],
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
