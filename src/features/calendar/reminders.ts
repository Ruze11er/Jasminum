import { toast } from '@/design-system';
import { db } from '@/data/db';
import { ALL_DAY_REMINDER_TIME, occurrences, type EventOccurrence } from '@/data/repos/events';
import type { CalendarEvent } from '@/data/types';
import { clock } from '@/lib/clock';
import { addLocalDays, dayLabel, localDateOf, localDateTimeToIso, timeLabel } from '@/lib/dates';
import { showSystemNotification } from '@/platform/notifications';

/**
 * In-app reminders. A web app without a server can't wake itself up, so reminders only
 * fire while Jasminum is open (as a toast, plus a system notification if allowed).
 */

export interface DueReminder {
  key: string;
  occ: EventOccurrence;
  fireAt: number;
}

const MINUTE = 60_000;

/** Reminders that fall due after `after` and up to `upTo` (epoch ms). Pure; tested. */
export function remindersBetween(events: CalendarEvent[], after: number, upTo: number) {
  const due: DueReminder[] = [];
  for (const event of events) {
    if (event.deletedAt || event.reminderMinutes === null) continue;
    const lead = event.reminderMinutes * MINUTE;
    // Occurrences that could start between `after` and `upTo + lead`.
    const from = addLocalDays(localDateOf(after), -1);
    const to = addLocalDays(localDateOf(upTo + lead), 1);
    for (const occ of occurrences(event, from, to)) {
      const startsAt = occ.startTime
        ? occ.startsAt
        : Date.parse(localDateTimeToIso(occ.date, ALL_DAY_REMINDER_TIME));
      const fireAt = startsAt - lead;
      if (fireAt > after && fireAt <= upTo) due.push({ key: `${occ.key}:${fireAt}`, occ, fireAt });
    }
  }
  return due.sort((a, b) => a.fireAt - b.fireAt);
}

/** "Dentist · Today, 3:00 PM" or "Mom's birthday · Tomorrow". */
export function reminderText(occ: EventOccurrence, now: number): string {
  const when = dayLabel(occ.date, localDateOf(now));
  return occ.startTime
    ? `${occ.event.title} · ${when}, ${timeLabel(occ.startTime)}`
    : `${occ.event.title} · ${when}`;
}

const CHECK_EVERY_MS = 30_000;
/** On start, catch up on reminders missed in the last few minutes (e.g. during a reload). */
const CATCH_UP_MS = 10 * MINUTE;
const STORAGE_KEY = 'jasminum:reminders-checked-at';

function readCheckedAt(): number | null {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function writeCheckedAt(ms: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(ms));
  } catch {
    // Private mode or blocked storage: reminders still work for this session.
  }
}

/** Starts checking for due reminders. Returns a function that stops it. */
export function startReminders(): () => void {
  const now = clock.now();
  let checkedAt = Math.max(readCheckedAt() ?? now, now - CATCH_UP_MS);
  const shown = new Set<string>();
  let stopped = false;

  const check = async () => {
    const upTo = clock.now();
    if (upTo <= checkedAt) return;
    try {
      const events = await db.events
        .filter((e) => !e.deletedAt && e.reminderMinutes !== null)
        .toArray();
      if (stopped) return;
      for (const r of remindersBetween(events, checkedAt, upTo)) {
        if (shown.has(r.key)) continue;
        shown.add(r.key);
        const text = reminderText(r.occ, upTo);
        toast({ tone: 'info', message: `Reminder: ${text}`, durationMs: 15_000 });
        if (document.visibilityState === 'hidden') {
          void showSystemNotification('Jasminum reminder', text, r.key);
        }
      }
      checkedAt = upTo;
      writeCheckedAt(upTo);
    } catch (err) {
      // The database may be closing (another tab upgrading); try again next tick.
      console.warn('Reminder check failed', err);
    }
  };

  // Timers slow down in background tabs, so also check as soon as the app is visible again.
  const onVisible = () => {
    if (document.visibilityState === 'visible') void check();
  };
  const timer = setInterval(() => void check(), CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', onVisible);
  void check();

  return () => {
    stopped = true;
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
