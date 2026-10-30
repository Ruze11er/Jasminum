import { addDays, addMonths, addYears, getDay, startOfWeek } from 'date-fns';
import type { LocalDate } from '@/data/types';
import { daysBetween, parseLocalDate, toLocalDate } from './dates';

/**
 * Repeating schedules, stored in standard iCalendar form so they can be exported later:
 *
 *   DTSTART;VALUE=DATE:20260130
 *   RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE
 *
 * Supported: FREQ (DAILY, WEEKLY, MONTHLY, YEARLY), INTERVAL, BYDAY (weekly only), UNTIL.
 * One deliberate difference from the iCalendar spec: a monthly rule on the 31st falls on
 * the last day of shorter months (and Feb 29 on Feb 28), which is what people expect.
 */

export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type Weekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

export const WEEKDAYS: Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
/** date-fns getDay(): 0 = Sunday. */
const JS_DAY: Record<Weekday, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

export interface Recurrence {
  /** First occurrence; also the anchor every later occurrence is computed from. */
  start: LocalDate;
  freq: Frequency;
  interval: number;
  /** Weekly only. Empty means "the start date's weekday". */
  byDay: Weekday[];
  until: LocalDate | null;
}

export const MAX_INTERVAL = 99;

// ---------- serialize ----------

const compact = (d: LocalDate) => d.replaceAll('-', '');
const expand = (s: string): LocalDate | null =>
  /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null;

export function formatRecurrence(r: Recurrence): string {
  const parts = [`FREQ=${r.freq}`, `INTERVAL=${r.interval}`];
  if (r.freq === 'WEEKLY' && r.byDay.length) parts.push(`BYDAY=${sortDays(r.byDay).join(',')}`);
  if (r.until) parts.push(`UNTIL=${compact(r.until)}`);
  return `DTSTART;VALUE=DATE:${compact(r.start)}\nRRULE:${parts.join(';')}`;
}

/** Returns null for anything malformed or unsupported. */
export function parseRecurrence(text: string): Recurrence | null {
  const startMatch = /DTSTART;VALUE=DATE:(\d{8})/.exec(text);
  const ruleMatch = /RRULE:([^\n]+)/.exec(text);
  const start = startMatch && expand(startMatch[1]!);
  if (!start || !ruleMatch) return null;

  const fields = new Map(ruleMatch[1]!.split(';').map((p) => p.split('=') as [string, string]));
  const freq = fields.get('FREQ') as Frequency | undefined;
  if (!freq || !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return null;

  const interval = Number(fields.get('INTERVAL') ?? '1');
  if (!Number.isInteger(interval) || interval < 1 || interval > MAX_INTERVAL) return null;

  const byDayRaw = fields.get('BYDAY');
  const byDay = byDayRaw ? (byDayRaw.split(',') as Weekday[]) : [];
  if (byDay.some((d) => !WEEKDAYS.includes(d))) return null;
  if (byDay.length && freq !== 'WEEKLY') return null;

  const untilRaw = fields.get('UNTIL');
  const until = untilRaw ? expand(untilRaw.slice(0, 8)) : null;
  if (untilRaw && !until) return null;

  return { start, freq, interval, byDay: sortDays(byDay), until };
}

const sortDays = (days: Weekday[]) =>
  [...new Set(days)].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b));

// ---------- compute ----------

/** The n-th occurrence (n ≥ 0) for rules with one occurrence per period. */
function nth(r: Recurrence, n: number): LocalDate {
  const start = parseLocalDate(r.start);
  switch (r.freq) {
    case 'DAILY':
      return toLocalDate(addDays(start, n * r.interval));
    case 'WEEKLY':
      return toLocalDate(addDays(start, n * 7 * r.interval));
    case 'MONTHLY':
      // date-fns clamps Jan 31 + 1 month to Feb 28/29: our "last day of month" behaviour.
      return toLocalDate(addMonths(start, n * r.interval));
    case 'YEARLY':
      return toLocalDate(addYears(start, n * r.interval));
  }
}

/** Rough period length in days, used to jump close to the answer instead of looping. */
const PERIOD_DAYS: Record<Frequency, number> = { DAILY: 1, WEEKLY: 7, MONTHLY: 28, YEARLY: 365 };

/** First occurrence strictly after `after`, or null if the rule has ended. */
export function nextOccurrence(r: Recurrence, after: LocalDate): LocalDate | null {
  let result: LocalDate | null;
  if (r.freq === 'WEEKLY' && r.byDay.length) {
    result = nextWeeklyByDay(r, after);
  } else {
    // Start from an estimate a little below the answer, then step forward.
    const gap = daysBetween(r.start, after);
    let n = gap < 0 ? 0 : Math.max(0, Math.floor(gap / (PERIOD_DAYS[r.freq] * r.interval)) - 1);
    result = nth(r, n);
    while (result <= after) result = nth(r, ++n);
  }
  return result && r.until && result > r.until ? null : result;
}

/** Weekly with chosen days: weeks are counted from the start date's week (Monday-based). */
function nextWeeklyByDay(r: Recurrence, after: LocalDate): LocalDate | null {
  const start = parseLocalDate(r.start);
  const firstWeek = startOfWeek(start, { weekStartsOn: 1 });
  const wanted = new Set(r.byDay.map((d) => JS_DAY[d]));
  let day = parseLocalDate(after > r.start ? after : r.start);
  if (after >= r.start) day = addDays(day, 1);
  // At most `interval` weeks plus one more need checking.
  for (let i = 0; i < 7 * (r.interval + 1); i++, day = addDays(day, 1)) {
    const weekIndex = Math.floor(daysBetween(toLocalDate(firstWeek), toLocalDate(day)) / 7);
    if (weekIndex % r.interval === 0 && wanted.has(getDay(day))) return toLocalDate(day);
  }
  return null;
}

/** All occurrences from `from` to `to` (inclusive), capped for safety. Used by the calendar. */
export function occurrencesBetween(
  r: Recurrence,
  from: LocalDate,
  to: LocalDate,
  limit = 500,
): LocalDate[] {
  const out: LocalDate[] = [];
  let cursor = nextOccurrence(r, addDaysStr(from, -1));
  while (cursor && cursor <= to && out.length < limit) {
    out.push(cursor);
    cursor = nextOccurrence(r, cursor);
  }
  return out;
}

const addDaysStr = (d: LocalDate, n: number) => toLocalDate(addDays(parseLocalDate(d), n));

// ---------- describe ----------

const DAY_NAMES: Record<Weekday, string> = {
  MO: 'Mon',
  TU: 'Tue',
  WE: 'Wed',
  TH: 'Thu',
  FR: 'Fri',
  SA: 'Sat',
  SU: 'Sun',
};

/** "Every day", "Every 2 weeks on Mon, Wed", "Every weekday", "Every month on the 31st". */
export function describeRecurrence(r: Recurrence): string {
  const n = r.interval;
  const every = (unit: string) => (n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`);
  const start = parseLocalDate(r.start);
  let text: string;
  switch (r.freq) {
    case 'DAILY':
      text = every('day');
      break;
    case 'WEEKLY': {
      const days = r.byDay.length ? r.byDay : [WEEKDAYS[(getDay(start) + 6) % 7]!];
      if (n === 1 && days.join() === 'MO,TU,WE,TH,FR') text = 'Every weekday';
      else text = `${every('week')} on ${days.map((d) => DAY_NAMES[d]).join(', ')}`;
      break;
    }
    case 'MONTHLY':
      text = `${every('month')} on the ${ordinal(start.getDate())}`;
      break;
    case 'YEARLY':
      text = `${every('year')} on ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(start)}`;
      break;
  }
  return r.until ? `${text} until ${r.until}` : text;
}

function ordinal(n: number) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${s}`;
}
