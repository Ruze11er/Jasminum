import { describe, expect, it } from 'vitest';
import type { EventOccurrence } from '@/data/repos/events';
import type { CalendarEvent, Task } from '@/data/types';
import {
  compareItems,
  itemsByDay,
  monthGrid,
  rangeTitle,
  shiftDate,
  startOfWeek,
  visibleRange,
  weekDays,
  weekdayLabels,
} from './selectors';

describe('weeks and month grids', () => {
  // 2026-11-04 is a Wednesday.
  it('finds the start of the week for each week-start setting', () => {
    expect(startOfWeek('2026-11-04', 1)).toBe('2026-11-02'); // Monday
    expect(startOfWeek('2026-11-04', 0)).toBe('2026-11-01'); // Sunday
    expect(startOfWeek('2026-11-04', 6)).toBe('2026-10-31'); // Saturday
    expect(startOfWeek('2026-11-02', 1)).toBe('2026-11-02');
    expect(weekDays('2026-11-04', 1)).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ]);
  });

  it('builds whole weeks covering the month', () => {
    const nov = monthGrid('2026-11-15', 1);
    expect(nov).toHaveLength(6); // Nov 1 is a Sunday, Nov 30 a Monday
    expect(nov[0]![0]).toBe('2026-10-26');
    expect(nov.at(-1)![6]).toBe('2026-12-06');
    for (const week of nov) expect(week).toHaveLength(7);

    const feb = monthGrid('2027-02-10', 1); // Feb 2027 starts on a Monday: exactly 4 weeks
    expect(feb).toHaveLength(4);
    expect(feb[0]![0]).toBe('2027-02-01');
    expect(feb[3]![6]).toBe('2027-02-28');

    expect(monthGrid('2026-11-15', 0)[0]![0]).toBe('2026-11-01');
  });

  it('gives the visible range of each view', () => {
    expect(visibleRange('day', '2026-11-04', 1)).toEqual({ from: '2026-11-04', to: '2026-11-04' });
    expect(visibleRange('week', '2026-11-04', 0)).toEqual({
      from: '2026-11-01',
      to: '2026-11-07',
    });
    expect(visibleRange('month', '2026-11-04', 1)).toEqual({
      from: '2026-10-26',
      to: '2026-12-06',
    });
  });

  it('pages through days, weeks and months', () => {
    expect(shiftDate('day', '2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDate('week', '2026-11-04', -1)).toBe('2026-10-28');
    expect(shiftDate('month', '2026-01-31', 1)).toBe('2026-02-28');
    expect(shiftDate('month', '2026-01-15', -1)).toBe('2025-12-15');
  });

  it('navigates twelve months forward without skipping any', () => {
    let date = '2026-01-31';
    const months: string[] = [];
    for (let i = 0; i < 12; i++) {
      months.push(date.slice(0, 7));
      date = shiftDate('month', date, 1);
    }
    expect(new Set(months).size).toBe(12);
    expect(months.at(-1)).toBe('2026-12');
  });

  it('labels the range and weekdays', () => {
    expect(rangeTitle('month', '2026-11-04', 1)).toMatch(/November.*2026/);
    expect(rangeTitle('week', '2026-11-04', 1)).toMatch(/Nov/);
    expect(rangeTitle('day', '2026-11-04', 1)).toMatch(/Wednesday/);
    expect(weekdayLabels(1)[0]).toMatch(/Mon/);
    expect(weekdayLabels(0)[0]).toMatch(/Sun/);
    expect(weekdayLabels(6)[0]).toMatch(/Sat/);
  });
});

// ---------- items ----------

const event = (title: string): CalendarEvent => ({
  id: title,
  title,
  description: '',
  start: '',
  end: '',
  allDay: 0,
  location: '',
  categoryId: null,
  tagIds: [],
  rrule: null,
  exdates: [],
  reminderMinutes: null,
  createdAt: 0,
  updatedAt: 0,
  deletedAt: null,
});

const occ = (
  title: string,
  date: string,
  endDate = date,
  startTime: string | null = null,
): EventOccurrence => ({
  key: `${title}:${date}`,
  event: event(title),
  date,
  endDate,
  startTime,
  endTime: startTime,
  startsAt: 0,
});

const task = (title: string, dueDate: string | null, dueTime: string | null = null): Task => ({
  id: title,
  title,
  description: '',
  status: 'todo',
  priority: 0,
  dueDate,
  dueTime,
  scheduledDate: null,
  completedAt: null,
  categoryId: null,
  tagIds: [],
  rrule: null,
  seriesId: null,
  postponeCount: 0,
  originalDueDate: null,
  reminderAt: null,
  order: 0,
  createdAt: 0,
  updatedAt: 0,
  deletedAt: null,
});

describe('items by day', () => {
  it('merges events and tasks: all-day first, then untimed tasks, then by time', () => {
    const map = itemsByDay(
      [occ('Lecture', '2026-11-04', '2026-11-04', '10:00'), occ('Holiday', '2026-11-04')],
      [
        task('Essay', '2026-11-04', '09:30'),
        task('Groceries', '2026-11-04'),
        task('Call', '2026-11-04', '10:00'),
      ],
      '2026-11-01',
      '2026-11-30',
    );
    expect(map.get('2026-11-04')!.map((i) => i.title)).toEqual([
      'Holiday',
      'Groceries',
      'Essay',
      'Lecture',
      'Call',
    ]);
  });

  it('shows multi-day events on each day they cover, clipped to the range', () => {
    const map = itemsByDay(
      [occ('Conference', '2026-10-30', '2026-11-02', '13:00')],
      [],
      '2026-11-01',
      '2026-11-07',
    );
    expect([...map.keys()]).toEqual(['2026-11-01', '2026-11-02']);
    const item = map.get('2026-11-01')![0]!;
    expect(item).toMatchObject({ kind: 'event', allDay: true, continued: true, time: null });
  });

  it('leaves out undated, deleted and out-of-range tasks', () => {
    const gone = { ...task('Gone', '2026-11-04'), deletedAt: 1 };
    const map = itemsByDay(
      [],
      [task('Someday', null), gone, task('Later', '2026-12-04'), task('Now', '2026-11-04')],
      '2026-11-01',
      '2026-11-30',
    );
    expect([...map.values()].flat().map((i) => i.title)).toEqual(['Now']);
  });

  it('puts an event before a task at the same time', () => {
    const [a] = itemsByDay(
      [occ('Meet', '2026-11-04', '2026-11-04', '10:00')],
      [],
      '2026-11-04',
      '2026-11-04',
    ).get('2026-11-04')!;
    const [b] = itemsByDay(
      [],
      [task('Ask', '2026-11-04', '10:00')],
      '2026-11-04',
      '2026-11-04',
    ).get('2026-11-04')!;
    expect(compareItems(a!, b!)).toBeLessThan(0);
  });
});
