import { addDays, differenceInCalendarDays, isValid } from 'date-fns';
import type { LocalDate } from '@/data/types';

/**
 * Helpers for calendar days stored as local "YYYY-MM-DD" strings. These strings sort
 * correctly as plain text and never shift with time zones, unlike Date objects at midnight.
 */

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLocalDate(value: string): boolean {
  const m = LOCAL_DATE_RE.exec(value);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isValid(d) && toLocalDate(d) === value;
}

/** "2026-10-30" → Date at local midnight. */
export function parseLocalDate(value: LocalDate): Date {
  const m = LOCAL_DATE_RE.exec(value);
  if (!m) throw new Error(`Invalid local date: ${value}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Hand-written instead of date-fns `format`, which would add ~6 KB to the first load. */
export const toLocalDate = (date: Date): LocalDate =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Today's local date for a given instant (defaults to the app clock via the caller). */
export const localDateOf = (ms: number): LocalDate => toLocalDate(new Date(ms));

export const addLocalDays = (value: LocalDate, days: number): LocalDate =>
  toLocalDate(addDays(parseLocalDate(value), days));

/** b − a in calendar days. */
export const daysBetween = (a: LocalDate, b: LocalDate): number =>
  differenceInCalendarDays(parseLocalDate(b), parseLocalDate(a));

/**
 * Friendly label relative to today: "Today", "Tomorrow", "Yesterday", a weekday name for
 * the coming week, otherwise "Mon, Nov 3" (with the year if it isn't this year).
 */
export function dayLabel(value: LocalDate, today: LocalDate): string {
  const diff = daysBetween(today, value);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const date = parseLocalDate(value);
  if (diff > 1 && diff < 7)
    return new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(date);
  const sameYear = value.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date);
}

/** "14:30" → locale time such as "2:30 PM". */
export function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
    new Date(2000, 0, 1, h, m),
  );
}
