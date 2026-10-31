import { afterEach, describe, expect, it } from 'vitest';
import { waitFor } from '@testing-library/react';
import { useToasts } from '@/design-system/components/toastStore';
import { eventsRepo, type EventInput } from '@/data/repos/events';
import { clock } from '@/lib/clock';
import { localDateTimeToIso } from '@/lib/dates';
import { formatRecurrence } from '@/lib/recurrence';
import { remindersBetween, reminderText, startReminders } from './reminders';

const at = (date: string, time: string) => Date.parse(localDateTimeToIso(date, time));
const MIN = 60_000;

const lesson = (extra: Partial<EventInput> = {}): EventInput => ({
  title: 'Piano lesson',
  start: localDateTimeToIso('2026-11-10', '15:00'),
  end: localDateTimeToIso('2026-11-10', '16:00'),
  reminderMinutes: 15,
  ...extra,
});

let stop: (() => void) | undefined;
afterEach(() => stop?.());

describe('reminders', () => {
  it('finds a timed reminder in its window only', async () => {
    const e = await eventsRepo.create(lesson());
    const fireAt = at('2026-11-10', '14:45');
    expect(remindersBetween([e], fireAt - MIN, fireAt)).toMatchObject([{ fireAt }]);
    expect(remindersBetween([e], fireAt, fireAt + 10 * MIN)).toEqual([]);
    expect(remindersBetween([e], fireAt - 10 * MIN, fireAt - MIN)).toEqual([]);
  });

  it('counts all-day reminders from 9:00, including the day before', async () => {
    const e = await eventsRepo.create({
      title: 'Mom’s birthday',
      allDay: 1,
      start: '2026-11-10',
      end: '2026-11-10',
      reminderMinutes: 1440,
    });
    const fireAt = at('2026-11-09', '09:00');
    const [r] = remindersBetween([e], fireAt - MIN, fireAt);
    expect(r?.fireAt).toBe(fireAt);
    expect(reminderText(r!.occ, fireAt)).toBe('Mom’s birthday · Tomorrow');
  });

  it('reminds for each repeat and skips excluded days, deleted events and no-reminder events', async () => {
    const weekly = await eventsRepo.create(
      lesson({
        rrule: formatRecurrence({
          start: '2026-11-10',
          freq: 'WEEKLY',
          interval: 1,
          byDay: [],
          until: null,
        }),
        exdates: ['2026-11-17'],
      }),
    );
    const quiet = await eventsRepo.create(lesson({ title: 'Quiet', reminderMinutes: null }));
    const gone = { ...(await eventsRepo.create(lesson({ title: 'Gone' }))), deletedAt: 1 };
    const found = remindersBetween(
      [weekly, quiet, gone],
      at('2026-11-01', '00:00'),
      at('2026-11-30', '00:00'),
    );
    expect(found.map((r) => r.occ.date)).toEqual(['2026-11-10', '2026-11-24']);
    expect(reminderText(found[0]!.occ, at('2026-11-10', '14:45'))).toMatch(
      /^Piano lesson · Today, 3:00/,
    );
  });

  it('shows a toast for a reminder that falls due while the app is open', async () => {
    clock.set(at('2026-11-10', '14:44'));
    localStorage.setItem('jasminum:reminders-checked-at', String(at('2026-11-10', '14:44')));
    await eventsRepo.create(lesson());
    stop = startReminders();
    clock.set(at('2026-11-10', '14:45'));
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() =>
      expect(useToasts.getState().toasts.map((t) => t.message)).toEqual([
        expect.stringMatching(/^Reminder: Piano lesson · Today/),
      ]),
    );
    // Checking again never repeats it.
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((r) => setTimeout(r, 50));
    expect(useToasts.getState().toasts).toHaveLength(1);
  });

  it('does not replay old reminders on first start', async () => {
    await eventsRepo.create(lesson());
    clock.set(at('2026-11-10', '16:00')); // an hour after it was due, never checked before
    stop = startReminders();
    await new Promise((r) => setTimeout(r, 50));
    expect(useToasts.getState().toasts).toEqual([]);
  });
});
