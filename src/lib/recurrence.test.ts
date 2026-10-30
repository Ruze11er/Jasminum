import { describe, expect, it } from 'vitest';
import {
  describeRecurrence,
  formatRecurrence,
  nextOccurrence,
  occurrencesBetween,
  parseRecurrence,
  type Recurrence,
} from './recurrence';
import { addLocalDays, dayLabel, isLocalDate, daysBetween } from './dates';

const rule = (r: Partial<Recurrence> & Pick<Recurrence, 'start' | 'freq'>): Recurrence => ({
  interval: 1,
  byDay: [],
  until: null,
  ...r,
});

describe('dates', () => {
  it('validates local dates', () => {
    expect(isLocalDate('2026-02-28')).toBe(true);
    expect(isLocalDate('2026-02-30')).toBe(false);
    expect(isLocalDate('2026-2-3')).toBe(false);
  });

  it('adds days across month, year and DST boundaries', () => {
    expect(addLocalDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addLocalDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addLocalDays('2026-03-07', 2)).toBe('2026-03-09'); // US DST starts Mar 8
    expect(addLocalDays('2026-11-01', -1)).toBe('2026-10-31');
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
  });

  it('labels days relative to today', () => {
    const today = '2026-10-30'; // a Friday
    expect(dayLabel('2026-10-30', today)).toBe('Today');
    expect(dayLabel('2026-10-31', today)).toBe('Tomorrow');
    expect(dayLabel('2026-10-29', today)).toBe('Yesterday');
    expect(dayLabel('2026-11-02', today)).toMatch(/Monday/);
    expect(dayLabel('2027-01-05', today)).toMatch(/2027/);
  });
});

describe('recurrence parse/format', () => {
  it('round-trips through iCalendar text', () => {
    const r = rule({
      start: '2026-10-30',
      freq: 'WEEKLY',
      interval: 2,
      byDay: ['WE', 'MO'],
      until: '2027-01-01',
    });
    const text = formatRecurrence(r);
    expect(text).toBe(
      'DTSTART;VALUE=DATE:20261030\nRRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20270101',
    );
    expect(parseRecurrence(text)).toEqual({ ...r, byDay: ['MO', 'WE'] });
  });

  it.each([
    'RRULE:FREQ=DAILY',
    'DTSTART;VALUE=DATE:20261030\nRRULE:FREQ=HOURLY',
    'DTSTART;VALUE=DATE:20261030\nRRULE:FREQ=DAILY;INTERVAL=0',
    'DTSTART;VALUE=DATE:20261030\nRRULE:FREQ=DAILY;BYDAY=MO',
    'DTSTART;VALUE=DATE:20261030\nRRULE:FREQ=WEEKLY;BYDAY=XX',
  ])('rejects unsupported input %#', (text) => {
    expect(parseRecurrence(text)).toBeNull();
  });
});

describe('nextOccurrence', () => {
  it('daily, every N days', () => {
    const r = rule({ start: '2026-10-30', freq: 'DAILY', interval: 3 });
    expect(nextOccurrence(r, '2026-10-29')).toBe('2026-10-30');
    expect(nextOccurrence(r, '2026-10-30')).toBe('2026-11-02');
    expect(nextOccurrence(r, '2026-11-01')).toBe('2026-11-02');
    expect(nextOccurrence(r, '2027-10-30')).toBe('2027-10-31'); // far ahead, still aligned
  });

  it('weekly on the start weekday', () => {
    const r = rule({ start: '2026-10-30', freq: 'WEEKLY' }); // Friday
    expect(nextOccurrence(r, '2026-10-30')).toBe('2026-11-06');
  });

  it('weekly on chosen days, every other week', () => {
    // Starts Wed Oct 28 2026; weeks of Oct 26, Nov 9, Nov 23… are "on" weeks.
    const r = rule({ start: '2026-10-28', freq: 'WEEKLY', interval: 2, byDay: ['MO', 'WE', 'FR'] });
    expect(occurrencesBetween(r, '2026-10-26', '2026-11-15')).toEqual([
      '2026-10-28',
      '2026-10-30',
      '2026-11-09',
      '2026-11-11',
      '2026-11-13',
    ]);
  });

  it('every weekday skips weekends', () => {
    const r = rule({ start: '2026-10-30', freq: 'WEEKLY', byDay: ['MO', 'TU', 'WE', 'TH', 'FR'] });
    expect(nextOccurrence(r, '2026-10-30')).toBe('2026-11-02');
  });

  it('monthly on the 31st falls on the last day of short months without drifting', () => {
    const r = rule({ start: '2026-01-31', freq: 'MONTHLY' });
    expect(occurrencesBetween(r, '2026-01-01', '2026-05-31')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ]);
  });

  it('yearly on Feb 29 uses Feb 28 in non-leap years', () => {
    const r = rule({ start: '2028-02-29', freq: 'YEARLY' });
    expect(nextOccurrence(r, '2028-02-29')).toBe('2029-02-28');
    expect(nextOccurrence(r, '2031-03-01')).toBe('2032-02-29');
  });

  it('stops after UNTIL', () => {
    const r = rule({ start: '2026-10-30', freq: 'DAILY', until: '2026-11-01' });
    expect(nextOccurrence(r, '2026-10-31')).toBe('2026-11-01');
    expect(nextOccurrence(r, '2026-11-01')).toBeNull();
  });
});

describe('describeRecurrence', () => {
  it.each([
    [rule({ start: '2026-10-30', freq: 'DAILY' }), 'Every day'],
    [rule({ start: '2026-10-30', freq: 'DAILY', interval: 2 }), 'Every 2 days'],
    [rule({ start: '2026-10-30', freq: 'WEEKLY' }), 'Every week on Fri'],
    [
      rule({ start: '2026-10-30', freq: 'WEEKLY', byDay: ['MO', 'TU', 'WE', 'TH', 'FR'] }),
      'Every weekday',
    ],
    [rule({ start: '2026-10-31', freq: 'MONTHLY' }), 'Every month on the 31st'],
    [rule({ start: '2026-10-22', freq: 'MONTHLY', interval: 3 }), 'Every 3 months on the 22nd'],
  ])('%#: %s', (r, text) => expect(describeRecurrence(r)).toBe(text));
});
