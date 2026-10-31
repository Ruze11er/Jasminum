import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemePreference = 'light' | 'dark' | 'system';
export type LibraryLayout = 'grid' | 'list';

interface UiState {
  theme: ThemePreference;
  sidebarCollapsed: boolean;
  quickAddOpen: boolean;
  libraryLayout: LibraryLayout;
  setTheme: (theme: ThemePreference) => void;
  toggleSidebar: () => void;
  setQuickAddOpen: (open: boolean) => void;
  setLibraryLayout: (layout: LibraryLayout) => void;
}

/**
 * Small per-device UI preferences. User data (tasks, notes, files) never lives here;
 * it goes in the IndexedDB database added in Phase 2.
 */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      sidebarCollapsed: false,
      quickAddOpen: false,
      libraryLayout: 'grid',
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setQuickAddOpen: (quickAddOpen) => set({ quickAddOpen }),
      setLibraryLayout: (libraryLayout) => set({ libraryLayout }),
    }),
    {
      name: 'jasminum-ui',
      partialize: (s) => ({
        theme: s.theme,
        sidebarCollapsed: s.sidebarCollapsed,
        libraryLayout: s.libraryLayout,
      }),
    },
  ),
);
