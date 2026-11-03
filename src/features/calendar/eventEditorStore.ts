import { create } from 'zustand';
import type { LocalDate } from '@/data/types';

export interface EventDefaults {
  date?: LocalDate;
  allDay?: boolean;
  /** "HH:mm" */
  startTime?: string;
}

interface EventEditorState {
  open: boolean;
  /** null when creating a new event. */
  eventId: string | null;
  /** The occurrence that was tapped, for "delete this event only" on repeating events. */
  occurrenceDate: LocalDate | null;
  defaults: EventDefaults;
  /** Goes up on every open, so the form can tell a fresh load from the previous one. */
  session: number;
  openNew: (defaults?: EventDefaults) => void;
  openEdit: (eventId: string, occurrenceDate?: LocalDate) => void;
  close: () => void;
}

/** Opens the event form from anywhere: the calendar or the global "+" button. */
export const useEventEditor = create<EventEditorState>((set) => ({
  open: false,
  eventId: null,
  occurrenceDate: null,
  defaults: {},
  session: 0,
  openNew: (defaults = {}) =>
    set((s) => ({
      open: true,
      eventId: null,
      occurrenceDate: null,
      defaults,
      session: s.session + 1,
    })),
  openEdit: (eventId, occurrenceDate) =>
    set((s) => ({
      open: true,
      eventId,
      occurrenceDate: occurrenceDate ?? null,
      defaults: {},
      session: s.session + 1,
    })),
  close: () => set({ open: false }),
}));
