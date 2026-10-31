import { ALL_DAY_REMINDER_TIME, type EventInput } from '@/data/repos/events';
import type { CalendarEvent, LocalDate } from '@/data/types';
import {
  addLocalDays,
  daysBetween,
  localDateOf,
  localDateTimeToIso,
  splitIso,
  timeLabel,
  toLocalDate,
  toLocalTime,
} from '@/lib/dates';
import { repeatFromRule, toRule, type RepeatState } from '@/features/tasks/repeat';
import type { EventDefaults } from './eventEditorStore';

/** What the event form edits. Converted to an `EventInput` on save. */
export interface EventDraft {
  title: string;
  description: string;
  location: string;
  allDay: boolean;
  startDate: LocalDate;
  startTime: string;
  endDate: LocalDate;
  endTime: string;
  categoryId: string | null;
  tagNames: string[];
  repeat: RepeatState;
  /** Minutes before the start as a string, or '' for no reminder (fits a <select>). */
  reminder: string;
}

const MINUTE = 60_000;

/** Local date + time shifted by some minutes (crosses midnight correctly). */
export function addMinutes(date: LocalDate, time: string, minutes: number) {
  const d = new Date(Date.parse(localDateTimeToIso(date, time)) + minutes * MINUTE);
  return { date: toLocalDate(d), time: toLocalTime(d) };
}

/** A new event: on the chosen day, starting at the next full hour if it's today, for one hour. */
export function newDraft(defaults: EventDefaults, now: number): EventDraft {
  const today = localDateOf(now);
  const date = defaults.date ?? today;
  let startTime = defaults.startTime ?? '09:00';
  let startDate = date;
  if (!defaults.startTime && date === today) {
    const next = new Date(now);
    next.setHours(next.getHours() + 1, 0, 0, 0);
    startDate = toLocalDate(next);
    startTime = toLocalTime(next);
  }
  const end = addMinutes(startDate, startTime, 60);
  return {
    title: '',
    description: '',
    location: '',
    allDay: defaults.allDay ?? false,
    startDate: defaults.allDay ? date : startDate,
    startTime,
    endDate: defaults.allDay ? date : end.date,
    endTime: end.time,
    categoryId: null,
    tagNames: [],
    repeat: repeatFromRule(null),
    reminder: '',
  };
}

export function draftFromEvent(event: CalendarEvent, tagNames: string[]): EventDraft {
  const timed = !event.allDay;
  const start = timed ? splitIso(event.start) : { date: event.start, time: '09:00' };
  const end = timed ? splitIso(event.end) : { date: event.end, time: '10:00' };
  return {
    title: event.title,
    description: event.description,
    location: event.location,
    allDay: !timed,
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    categoryId: event.categoryId,
    tagNames,
    repeat: repeatFromRule(event.rrule),
    reminder: event.reminderMinutes === null ? '' : String(event.reminderMinutes),
  };
}

export function draftToInput(draft: EventDraft, tagIds: string[]): EventInput {
  const timedValue = (date: LocalDate, time: string) =>
    date && time ? localDateTimeToIso(date, time) : '';
  return {
    title: draft.title,
    description: draft.description,
    location: draft.location,
    allDay: draft.allDay ? 1 : 0,
    start: draft.allDay ? draft.startDate : timedValue(draft.startDate, draft.startTime),
    end: draft.allDay ? draft.endDate : timedValue(draft.endDate, draft.endTime),
    categoryId: draft.categoryId,
    tagIds,
    rrule: draft.startDate ? toRule(draft.repeat, draft.startDate) : null,
    reminderMinutes: draft.reminder === '' ? null : Number(draft.reminder),
  };
}

const durationMinutes = (d: EventDraft) =>
  Math.round(
    (Date.parse(localDateTimeToIso(d.endDate, d.endTime)) -
      Date.parse(localDateTimeToIso(d.startDate, d.startTime))) /
      MINUTE,
  );

/**
 * Changing the start moves the end with it, so the event keeps its length (like most
 * calendar apps). All-day events keep their number of days; a timed event whose end was
 * before its start gets one hour.
 */
export function moveStart(
  draft: EventDraft,
  patch: Partial<Pick<EventDraft, 'startDate' | 'startTime'>>,
): EventDraft {
  const next = { ...draft, ...patch };
  if (!next.startDate || !draft.startDate || !draft.endDate) return next;
  if (draft.allDay) {
    const days = Math.max(0, daysBetween(draft.startDate, draft.endDate));
    return { ...next, endDate: addLocalDays(next.startDate, days) };
  }
  if (!next.startTime || !draft.startTime || !draft.endTime) return next;
  const length = durationMinutes(draft) >= 0 ? durationMinutes(draft) : 60;
  const end = addMinutes(next.startDate, next.startTime, length);
  return { ...next, endDate: end.date, endTime: end.time };
}

export interface ReminderOption {
  value: string;
  label: string;
}

export function reminderOptions(allDay: boolean): ReminderOption[] {
  if (allDay) {
    const at = timeLabel(ALL_DAY_REMINDER_TIME);
    return [
      { value: '', label: 'No reminder' },
      { value: '0', label: `On the day (${at})` },
      { value: '1440', label: `The day before (${at})` },
      { value: '10080', label: `A week before (${at})` },
    ];
  }
  return [
    { value: '', label: 'No reminder' },
    { value: '0', label: 'When it starts' },
    { value: '5', label: '5 minutes before' },
    { value: '15', label: '15 minutes before' },
    { value: '30', label: '30 minutes before' },
    { value: '60', label: '1 hour before' },
    { value: '1440', label: '1 day before' },
  ];
}
