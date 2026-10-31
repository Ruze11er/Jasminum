import { defineConfig, devices } from '@playwright/test';

// Playwright's WebKit build for Windows can't store files (no OPFS, no Blobs in IndexedDB)
// and blocks reloads while offline. Real Safari can, and so does WebKit on macOS and Linux,
// so only this combination skips the tests tagged @files and @offline.
const limitedWebKit = process.platform === 'win32' ? /@files|@offline/ : undefined;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Six browsers at once starve an 8 GB machine: service workers then miss their timeouts.
  workers: process.env.CI ? undefined : 3,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  // E2E runs against the production build so the service worker is real.
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    // Cross-browser: Firefox on desktop, Safari's engine on an iPhone-sized screen.
    { name: 'desktop-firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 14'] }, grepInvert: limitedWebKit },
  ],
});
