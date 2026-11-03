import { create } from 'zustand';
import type { TaskInput } from '@/data/repos/tasks';

interface TaskEditorState {
  open: boolean;
  /** null when creating a new task. */
  taskId: string | null;
  /** Pre-filled values for a new task (e.g. today's date). */
  defaults: Partial<TaskInput>;
  /** Goes up on every open, so the form can tell a fresh load from the previous one. */
  session: number;
  openNew: (defaults?: Partial<TaskInput>) => void;
  openEdit: (taskId: string) => void;
  close: () => void;
}

/** Opens the task form from anywhere: the Tasks page, Home, or the global "+" button. */
export const useTaskEditor = create<TaskEditorState>((set) => ({
  open: false,
  taskId: null,
  defaults: {},
  session: 0,
  openNew: (defaults = {}) =>
    set((s) => ({ open: true, taskId: null, defaults, session: s.session + 1 })),
  openEdit: (taskId) => set((s) => ({ open: true, taskId, defaults: {}, session: s.session + 1 })),
  close: () => set({ open: false }),
}));
