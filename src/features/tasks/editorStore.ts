import { create } from 'zustand';
import type { TaskInput } from '@/data/repos/tasks';

interface TaskEditorState {
  open: boolean;
  /** null when creating a new task. */
  taskId: string | null;
  /** Pre-filled values for a new task (e.g. today's date). */
  defaults: Partial<TaskInput>;
  openNew: (defaults?: Partial<TaskInput>) => void;
  openEdit: (taskId: string) => void;
  close: () => void;
}

/** Opens the task form from anywhere: the Tasks page, Home, or the global "+" button. */
export const useTaskEditor = create<TaskEditorState>((set) => ({
  open: false,
  taskId: null,
  defaults: {},
  openNew: (defaults = {}) => set({ open: true, taskId: null, defaults }),
  openEdit: (taskId) => set({ open: true, taskId, defaults: {} }),
  close: () => set({ open: false }),
}));
