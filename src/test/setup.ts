import 'fake-indexeddb/auto'; // in-memory IndexedDB for Dexie in tests
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import { useUiStore } from '@/stores/uiStore';
import { useToasts } from '@/design-system/components/toastStore';
import { useImportQueue } from '@/features/library/importStore';
import { useLockStore } from '@/stores/lockStore';
import { useEventEditor } from '@/features/calendar/eventEditorStore';
import { useTaskEditor } from '@/features/tasks/editorStore';
import { WELCOME_SEEN_KEY } from '@/app/layout/WelcomeSplash';
import { resetDatabase } from './db';

// Most tests run in jsdom; a few (e.g. file storage) run in plain Node with no window.
const isBrowserLike = typeof window !== 'undefined';

beforeEach(async () => {
  await resetDatabase();
  // The welcome splash would cover every page; welcome.test.tsx turns it back on.
  if (isBrowserLike) sessionStorage.setItem(WELCOME_SEEN_KEY, '1');
});

// Pages are lazy-loaded; the first cold load in a parallel run can take over a second.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  useUiStore.setState({
    theme: 'system',
    sidebarCollapsed: false,
    quickAddOpen: false,
    paletteOpen: false,
    libraryLayout: 'grid',
  });
  useImportQueue.setState({ items: [] });
  useLockStore.setState({ locked: false });
  // An editor left open would cover the next test's page with a dialog.
  useTaskEditor.setState({ open: false, taskId: null, defaults: {} });
  useEventEditor.setState({ open: false, eventId: null, occurrenceDate: null, defaults: {} });
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
