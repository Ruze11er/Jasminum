import { create } from 'zustand';

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  action?: { label: string; onClick: () => void | Promise<void> };
}

type ShowInput = Omit<Toast, 'id' | 'tone'> & { tone?: ToastTone; durationMs?: number };

interface ToastState {
  toasts: Toast[];
  show: (toast: ShowInput) => number;
  dismiss: (id: number) => void;
}

let nextId = 1;
const MAX_VISIBLE = 3;

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  show: ({ durationMs, tone = 'success', ...rest }) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, tone, ...rest }].slice(-MAX_VISIBLE) }));
    // Toasts with an Undo action stay longer so there is time to react.
    const ms = durationMs ?? (rest.action ? 7000 : 4000);
    setTimeout(() => get().dismiss(id), ms);
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Show a toast from anywhere (no hook needed). */
export const toast = (input: ShowInput) => useToasts.getState().show(input);
