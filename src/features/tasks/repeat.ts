import type { LocalDate } from '@/data/types';
import { parseLocalDate } from '@/lib/dates';
import {
  describeRecurrence,
  formatRecurrence,
  parseRecurrence,
  WEEKDAYS,
  type Frequency,
  type Recurrence,
  type Weekday,
} from '@/lib/recurrence';

export type RepeatPreset =
  'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly' | 'custom';

/** What the repeat picker edits. The start date always comes from the task's date. */
export interface RepeatState {
  preset: RepeatPreset;
  interval: number;
  unit: Frequency;
  byDay: Weekday[];
  /** Kept from imported rules; not editable in the picker yet. */
  until: LocalDate | null;
}

export const NO_REPEAT: RepeatState = {
  preset: 'none',
  interval: 1,
  unit: 'WEEKLY',
  byDay: [],
  until: null,
};

const WORKWEEK: Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR'];

export const weekdayOf = (date: LocalDate): Weekday =>
  WEEKDAYS[(parseLocalDate(date).getDay() + 6) % 7]!;

/** Turns a stored rule back into picker state, choosing the simplest matching preset. */
export function repeatFromRule(rrule: string | null): RepeatState {
  const r = rrule ? parseRecurrence(rrule) : null;
  if (!r) return NO_REPEAT;
  const base = { interval: r.interval, unit: r.freq, byDay: r.byDay, until: r.until };
  const simple = r.interval === 1 && !r.until;
  const startDay = weekdayOf(r.start);
  let preset: RepeatPreset = 'custom';
  if (simple && r.freq === 'DAILY') preset = 'daily';
  else if (simple && r.freq === 'WEEKLY' && r.byDay.join() === WORKWEEK.join()) preset = 'weekdays';
  else if (simple && r.freq === 'WEEKLY' && (r.byDay.length === 0 || r.byDay.join() === startDay))
    preset = 'weekly';
  else if (simple && r.freq === 'MONTHLY') preset = 'monthly';
  else if (simple && r.freq === 'YEARLY') preset = 'yearly';
  return { preset, ...base };
}

export function toRecurrence(state: RepeatState, start: LocalDate): Recurrence | null {
  const rule = (freq: Frequency, byDay: Weekday[] = [], interval = 1): Recurrence => ({
    start,
    freq,
    interval,
    byDay,
    until: state.until,
  });
  switch (state.preset) {
    case 'none':
      return null;
    case 'daily':
      return rule('DAILY');
    case 'weekdays':
      return rule('WEEKLY', WORKWEEK);
    case 'weekly':
      return rule('WEEKLY');
    case 'monthly':
      return rule('MONTHLY');
    case 'yearly':
      return rule('YEARLY');
    case 'custom': {
      const interval = Math.min(99, Math.max(1, Math.round(state.interval) || 1));
      const byDay = state.unit === 'WEEKLY' ? state.byDay : [];
      return rule(state.unit, byDay, interval);
    }
  }
}

/** The stored rule for a repeat choice, anchored on the task's date. */
export function toRule(state: RepeatState, start: LocalDate | null): string | null {
  if (!start) return null;
  const r = toRecurrence(state, start);
  return r ? formatRecurrence(r) : null;
}

/** Labels for the preset menu, using the task's date: "Every week on Fri". */
export function presetLabels(start: LocalDate | null): Record<RepeatPreset, string> {
  const d = start ?? '2026-01-05';
  const describe = (preset: RepeatPreset) =>
    describeRecurrence(toRecurrence({ ...NO_REPEAT, preset }, d)!);
  return {
    none: 'Does not repeat',
    daily: describe('daily'),
    weekdays: describe('weekdays'),
    weekly: start ? describe('weekly') : 'Every week',
    monthly: start ? describe('monthly') : 'Every month',
    yearly: start ? describe('yearly') : 'Every year',
    custom: 'Custom…',
  };
}
