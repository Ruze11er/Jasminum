/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Never reload the page on its own: the user confirms updates so nothing is lost mid-edit.
      registerType: 'prompt',
      pwaAssets: { config: true },
      includeAssets: ['icon.svg'],
      manifest: {
        id: '/',
        name: 'Jasminum — Personal Organizer',
        short_name: 'Jasminum',
        description: 'Your cozy, offline-first home for tasks, notes, calendar and study files.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#FFFBFC',
        theme_color: '#FFF5F8',
        categories: ['productivity', 'education'],
      },
      workbox: {
        // The web manifest is added by the plugin itself; listing it here too breaks the install.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,json}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // Bundle Workbox into sw.js: one less request, and setup errors fail loudly
        // instead of being silently swallowed by the async loader.
        inlineWorkboxRuntime: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
