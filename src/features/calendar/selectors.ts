import { addMonths } from 'date-fns';
import type { EventOccurrence } from '@/data/repos/events';
import type { WeekStart } from '@/data/repos/settings';
import type { LocalDate, Task } from '@/data/types';
import { addLocalDays, isLocalDate, parseLocalDate, toLocalDate } from '@/lib/dates';

export type CalendarView = 'day' | 'week' | 'month';

export const isCalendarView = (v: string | null): v is CalendarView =>
  v === 'day' || v === 'week' || v === 'month';

export const parseCursor = (v: string | null, fallback: LocalDate): LocalDate =>
  v && isLocalDate(v) ? v : fallback;

// ---------- grids ----------

/** The first day of the week containing `date`. */
export function startOfWeek(date: LocalDate, weekStartsOn: WeekStart): LocalDate {
  const dow = parseLocalDate(date).getDay();
  return addLocalDays(date, -((dow - weekStartsOn + 7) % 7));
}

/** The seven days of the week containing `date`. */
export function weekDays(date: LocalDate, weekStartsOn: WeekStart): LocalDate[] {
  const first = startOfWeek(date, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addLocalDays(first, i));
}

const firstOfMonth = (date: LocalDate) => `${date.slice(0, 7)}-01`;
const lastOfMonth = (date: LocalDate) =>
  addLocalDays(toLocalDate(addMonths(parseLocalDate(firstOfMonth(date)), 1)), -1);

/** Whole weeks covering the month of `date` (4 to 6 rows), padded with days of nearby months. */
export function monthGrid(date: LocalDate, weekStartsOn: WeekStart): LocalDate[][] {
  const last = lastOfMonth(date);
  const weeks: LocalDate[][] = [];
  let day = startOfWeek(firstOfMonth(date), weekStartsOn);
  while (day <= last) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addLocalDays(day, i)));
    day = addLocalDays(day, 7);
  }
  return weeks;
}

export const sameMonth = (a: LocalDate, b: LocalDate) => a.slice(0, 7) === b.slice(0, 7);

/** The days a view shows, inclusive. */
export function visibleRange(view: CalendarView, date: LocalDate, weekStartsOn: WeekStart) {
  if (view === 'day') return { from: date, to: date };
  if (view === 'week') {
    const from = startOfWeek(date, weekStartsOn);
    return { from, to: addLocalDays(from, 6) };
  }
  const weeks = monthGrid(date, weekStartsOn);
  return { from: weeks[0]![0]!, to: weeks.at(-1)![6]! };
}

/** Previous/next page. Moving by month keeps the day where possible (Jan 31 → Feb 28). */
export function shiftDate(view: CalendarView, date: LocalDate, step: 1 | -1): LocalDate {
  if (view === 'day') return addLocalDays(date, step);
  if (view === 'week') return addLocalDays(date, 7 * step);
  return toLocalDate(addMonths(parseLocalDate(date), step));
}

// ---------- labels ----------

const fmt = (date: LocalDate, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(undefined, options).format(parseLocalDate(date));

/** "November 2026", "Nov 2 – 8, 2026", "Monday, November 2". */
export function rangeTitle(view: CalendarView, date: LocalDate, weekStartsOn: WeekStart): string {
  if (view === 'month') return fmt(date, { month: 'long', year: 'numeric' });
  if (view === 'day') return fmt(date, { weekday: 'long', month: 'long', day: 'numeric' });
  const { from, to } = visibleRange('week', date, weekStartsOn);
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).formatRange(parseLocalDate(from), parseLocalDate(to));
}

/** Short weekday names in display order: ["Mon", "Tue", …]. */
export function weekdayLabels(weekStartsOn: WeekStart, style: 'short' | 'narrow' = 'short') {
  // 2026-11-01 is a Sunday.
  return Array.from({ length: 7 }, (_, i) =>
    fmt(addLocalDays('2026-11-01', (weekStartsOn + i) % 7), { weekday: style }),
  );
}

export const fullDayLabel = (date: LocalDate) =>
  fmt(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

// ---------- items per day ----------

export type CalendarItem =
  | {
      kind: 'event';
      key: string;
      occ: EventOccurrence;
      /** The day this item is listed under. */
      day: LocalDate;
      /** All-day, or a timed event on a day after the one it started. */
      allDay: boolean;
      /** True on the second and later days of a multi-day event. */
      continued: boolean;
      time: string | null;
      title: string;
    }
  | { kind: 'task'; key: string; task: Task; time: string | null; title: string };

/** All-day events first, then tasks without a time, then everything timed by time. */
const rank = (i: CalendarItem) =>
  i.kind === 'event' && i.allDay ? 0 : i.kind === 'task' && !i.time ? 1 : 2;

export function compareItems(a: CalendarItem, b: CalendarItem): number {
  return (
    rank(a) - rank(b) ||
    (a.time ?? '').localeCompare(b.time ?? '') ||
    (a.kind === b.kind ? 0 : a.kind === 'event' ? -1 : 1) ||
    a.title.localeCompare(b.title)
  );
}

/**
 * Groups event occurrences and dated tasks by day for the days `from`..`to`. Multi-day
 * events appear on every day they cover. Days without items are left out.
 */
export function itemsByDay(
  occurrences: EventOccurrence[],
  tasks: Task[],
  from: LocalDate,
  to: LocalDate,
): Map<LocalDate, CalendarItem[]> {
  const map = new Map<LocalDate, CalendarItem[]>();
  const push = (day: LocalDate, item: CalendarItem) => {
    const list = map.get(day);
    if (list) list.push(item);
    else map.set(day, [item]);
  };

  for (const occ of occurrences) {
    let day = occ.date < from ? from : occ.date;
    const last = occ.endDate > to ? to : occ.endDate;
    for (; day <= last; day = addLocalDays(day, 1)) {
      const continued = day !== occ.date;
      push(day, {
        kind: 'event',
        key: `${occ.key}@${day}`,
        occ,
        day,
        allDay: occ.startTime === null || continued,
        continued,
        time: continued ? null : occ.startTime,
        title: occ.event.title,
      });
    }
  }
  for (const task of tasks) {
    if (task.deletedAt || !task.dueDate || task.dueDate < from || task.dueDate > to) continue;
    push(task.dueDate, {
      kind: 'task',
      key: `task:${task.id}`,
      task,
      time: task.dueTime,
      title: task.title,
    });
  }
  for (const list of map.values()) list.sort(compareItems);
  return map;
}
