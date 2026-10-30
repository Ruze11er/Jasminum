import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import { useUiStore } from '@/stores/uiStore';

// Pages are lazy-loaded; the first cold load in a parallel run can take over a second.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
  localStorage.clear();
  // Shared UI state (e.g. an open sheet) must not leak between tests.
  useUiStore.setState({ theme: 'system', sidebarCollapsed: false, quickAddOpen: false });
  document.documentElement.classList.remove('dark');
});

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

// The service-worker module only exists in real Vite builds.
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}));
