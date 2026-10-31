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
        // Long-press the home-screen icon (Android, desktop) for these.
        shortcuts: [
          { name: 'New task', short_name: 'Task', url: '/tasks?new=1' },
          { name: 'New note', short_name: 'Note', url: '/notes/new' },
          { name: 'Calendar', short_name: 'Calendar', url: '/calendar' },
          { name: 'Library', short_name: 'Library', url: '/library' },
        ],
        // Android: "Share → Jasminum" sends files into the library. The service worker
        // (public/share-target-sw.js) receives them; see features/library/sharedFiles.ts.
        share_target: {
          action: '/share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
            files: [
              {
                name: 'files',
                accept: [
                  'application/pdf',
                  'image/*',
                  'text/*',
                  'application/epub+zip',
                  'application/msword',
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  'application/vnd.ms-powerpoint',
                  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                  'application/vnd.ms-excel',
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                  '.pdf',
                  '.epub',
                  '.docx',
                  '.pptx',
                  '.xlsx',
                ],
              },
            ],
          },
        },
      },
      workbox: {
        // The web manifest is added by the plugin itself; listing it here too breaks the install.
        // .mjs: the PDF engine's worker. Without it, PDFs couldn't be previewed offline.
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico,woff2,json}'],
        // iOS keeps its own copy of launch screens; precaching 40+ images would be waste.
        globIgnores: ['**/apple-splash-*'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // Bundle Workbox into sw.js: one less request, and setup errors fail loudly
        // instead of being silently swallowed by the async loader.
        inlineWorkboxRuntime: true,
        // Receives files shared into the app (Android share target). Loaded first, so
        // its POST handler runs before Workbox's routes (which only handle GET).
        importScripts: ['share-target-sw.js'],
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
    // UI tests that type and click can exceed the 5s default when the machine is busy.
    testTimeout: 15_000,
    // Each worker runs its own jsdom. The default (one per CPU core) runs out of memory
    // on an 8 GB machine and makes lazy-loaded pages miss their timeouts.
    maxWorkers: 4,
  },
});
