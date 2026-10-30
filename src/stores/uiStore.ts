import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemePreference = 'light' | 'dark' | 'system';

interface UiState {
  theme: ThemePreference;
  sidebarCollapsed: boolean;
  quickAddOpen: boolean;
  setTheme: (theme: ThemePreference) => void;
  toggleSidebar: () => void;
  setQuickAddOpen: (open: boolean) => void;
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
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setQuickAddOpen: (quickAddOpen) => set({ quickAddOpen }),
    }),
    {
      name: 'jasminum-ui',
      partialize: (s) => ({ theme: s.theme, sidebarCollapsed: s.sidebarCollapsed }),
    },
  ),
);
