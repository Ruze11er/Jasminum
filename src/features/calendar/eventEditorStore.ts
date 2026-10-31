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
  openNew: (defaults = {}) => set({ open: true, eventId: null, occurrenceDate: null, defaults }),
  openEdit: (eventId, occurrenceDate) =>
    set({ open: true, eventId, occurrenceDate: occurrenceDate ?? null, defaults: {} }),
  close: () => set({ open: false }),
}));
