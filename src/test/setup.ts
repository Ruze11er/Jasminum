import 'fake-indexeddb/auto'; // in-memory IndexedDB for Dexie in tests
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import { useUiStore } from '@/stores/uiStore';
import { useToasts } from '@/design-system/components/toastStore';
import { resetDatabase } from './db';

// Most tests run in jsdom; a few (e.g. file storage) run in plain Node with no window.
const isBrowserLike = typeof window !== 'undefined';

beforeEach(async () => {
  await resetDatabase();
});

// Pages are lazy-loaded; the first cold load in a parallel run can take over a second.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  useUiStore.setState({ theme: 'system', sidebarCollapsed: false, quickAddOpen: false });
  useToasts.setState({ toasts: [] });
  if (!isBrowserLike) return;
  cleanup();
  localStorage.clear();
  // Shared UI state (e.g. an open sheet) must not leak between tests.
  document.documentElement.classList.remove('dark');
});

if (isBrowserLike) {
  // jsdom has no matchMedia; default to a light OS theme.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

// The service-worker module only exists in real Vite builds.
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}));
