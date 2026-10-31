import { describe, expect, it } from 'vitest';
import { clock } from '@/lib/clock';
import { localDateTimeToIso, splitIso } from '@/lib/dates';
import { formatRecurrence, type Recurrence } from '@/lib/recurrence';
import { ValidationError } from '@/lib/validation';
import { db } from '../db';
import { searchIndex } from '../search/searchIndex';
import { deleteForever, listTrash, restoreFromTrash } from '../trash';
import { eventsRepo, expandEvents, occurrences, type EventInput } from './events';

// Built in the test machine's own time zone, so these tests pass anywhere.
const iso = (date: string, time: string) => localDateTimeToIso(date, time);
const rule = (start: string, r: Partial<Recurrence> = {}) =>
  formatRecurrence({ start, freq: 'DAILY', interval: 1, byDay: [], until: null, ...r });

const timed = (date: string, from = '09:00', to = '10:00'): EventInput => ({
  title: 'Study group',
  start: iso(date, from),
  end: iso(date, to),
});

describe('event validation', () => {
  it('fills defaults', async () => {
    clock.set(new Date('2026-10-30T12:00:00').getTime());
    const e = await eventsRepo.create({ ...timed('2026-11-02'), title: '  Study group ' });
    expect(e).toMatchObject({
      title: 'Study group',
      description: '',
      allDay: 0,
      location: '',
      categoryId: null,
      tagIds: [],
      rrule: null,
      exdates: [],
      reminderMinutes: null,
      deletedAt: null,
    });
  });

  it.each<[EventInput, string]>([
    [{ ...timed('2026-11-02'), title: ' ' }, 'Give your event a title'],
    [{ title: 'x', start: '2026-11-02', end: '2026-11-02' }, 'Pick a valid start'],
    [{ title: 'x', start: '2026-11-02T09:00', end: '2026-11-02T10:00' }, 'Pick a valid start'],
    [{ title: 'x', allDay: 1, start: '2026-11-02', end: '2026-02-30' }, 'Pick a valid end'],
    [{ ...timed('2026-11-02', '10:00', '09:00') }, "The event can't end before it starts"],
    [
      { title: 'x', allDay: 1, start: '2026-11-03', end: '2026-11-02' },
      "The event can't end before it starts",
    ],
    [{ ...timed('2026-11-02'), rrule: 'FREQ=DAILY' }, 'Invalid repeat rule'],
    [
      { ...timed('2026-11-02'), rrule: rule('2026-11-01') },
      'The repeat rule must start on the event date',
    ],
    [{ ...timed('2026-11-02'), reminderMinutes: -5 }, 'Pick a valid reminder'],
    [{ ...timed('2026-11-02'), exdates: ['soon'] }, 'Pick a valid date'],
  ])('rejects %j', async (input, message) => {
    const err = await eventsRepo.create(input).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as InstanceType<typeof ValidationError>).issues[0]?.message).toBe(message);
  });

  it('accepts zero-length and all-day events', async () => {
    await expect(eventsRepo.create(timed('2026-11-02', '09:00', '09:00'))).resolves.toBeTruthy();
    await expect(
      eventsRepo.create({ title: 'Trip', allDay: 1, start: '2026-11-02', end: '2026-11-04' }),
    ).resolves.toMatchObject({ allDay: 1 });
  });

  it('re-validates the whole event on update', async () => {
    const e = await eventsRepo.create(timed('2026-11-02'));
    const err = await eventsRepo.update(e.id, { end: iso('2026-11-01', '09:00') }).catch((x) => x);
    expect(err).toBeInstanceOf(ValidationError);
  });
});

describe('occurrences', () => {
  it('returns a one-off event only when it touches the range', async () => {
    const e = await eventsRepo.create(timed('2026-11-02', '14:30', '15:45'));
    expect(occurrences(e, '2026-11-03', '2026-11-30')).toEqual([]);
    const [occ] = occurrences(e, '2026-11-01', '2026-11-30');
    expect(occ).toMatchObject({
      key: `${e.id}:2026-11-02`,
      date: '2026-11-02',
      endDate: '2026-11-02',
      startTime: '14:30',
      endTime: '15:45',
      startsAt: Date.parse(iso('2026-11-02', '14:30')),
    });
  });

  it('includes multi-day events that started before the range', async () => {
    const trip = await eventsRepo.create({
      title: 'Trip',
      allDay: 1,
      start: '2026-10-30',
      end: '2026-11-02',
    });
    const [occ] = occurrences(trip, '2026-11-01', '2026-11-07');
    expect(occ).toMatchObject({ date: '2026-10-30', endDate: '2026-11-02', startTime: null });
    expect(occurrences(trip, '2026-11-03', '2026-11-07')).toEqual([]);
  });

  it('does not count a timed event ending at midnight as covering the next day', async () => {
    const party = await eventsRepo.create({
      title: 'Party',
      start: iso('2026-11-06', '20:00'),
      end: iso('2026-11-07', '00:00'),
    });
    expect(occurrences(party, '2026-11-06', '2026-11-07')[0]?.endDate).toBe('2026-11-06');
    expect(occurrences(party, '2026-11-07', '2026-11-08')).toEqual([]);
  });

  it('expands weekly repeats from the anchor and skips excluded dates', async () => {
    const e = await eventsRepo.create({
      ...timed('2026-11-02', '18:00', '19:00'), // a Monday
      rrule: rule('2026-11-02', { freq: 'WEEKLY', byDay: ['MO', 'TH'] }),
      exdates: ['2026-11-09'],
    });
    const dates = occurrences(e, '2026-11-01', '2026-11-16').map((o) => o.date);
    expect(dates).toEqual(['2026-11-02', '2026-11-05', '2026-11-12', '2026-11-16']);
    expect(occurrences(e, '2026-10-01', '2026-10-31')).toEqual([]);
  });

  it('keeps the wall-clock time for every occurrence, even across DST changes', async () => {
    const e = await eventsRepo.create({
      ...timed('2026-10-20', '08:00', '09:30'),
      rrule: rule('2026-10-20', { freq: 'WEEKLY' }),
    });
    for (const occ of occurrences(e, '2026-10-20', '2026-11-30')) {
      expect(occ.startTime).toBe('08:00');
      expect(splitIso(new Date(occ.startsAt).toISOString()).time).toBe('08:00');
    }
  });

  it('respects UNTIL and monthly month-end clamping', async () => {
    const e = await eventsRepo.create({
      title: 'Rent',
      allDay: 1,
      start: '2026-01-31',
      end: '2026-01-31',
      rrule: rule('2026-01-31', { freq: 'MONTHLY', until: '2026-04-30' }),
    });
    expect(occurrences(e, '2026-01-01', '2026-12-31').map((o) => o.date)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('expands repeating multi-day events that overlap the start of the range', async () => {
    const e = await eventsRepo.create({
      title: 'Weekend away',
      allDay: 1,
      start: '2026-10-31', // Sat–Sun
      end: '2026-11-01',
      rrule: rule('2026-10-31', { freq: 'WEEKLY' }),
    });
    expect(occurrences(e, '2026-11-01', '2026-11-08').map((o) => o.date)).toEqual([
      '2026-10-31',
      '2026-11-07',
    ]);
  });

  it('sorts occurrences from many events and leaves out deleted ones', async () => {
    const late = await eventsRepo.create({
      ...timed('2026-11-02', '16:00', '17:00'),
      title: 'Late',
    });
    const early = await eventsRepo.create({
      ...timed('2026-11-02', '08:00', '09:00'),
      title: 'Early',
    });
    const gone = await eventsRepo.create({ ...timed('2026-11-02'), title: 'Gone' });
    await eventsRepo.softDelete(gone.id);
    const events = [late, early, (await db.events.get(gone.id))!];
    expect(expandEvents(events, '2026-11-02', '2026-11-02').map((o) => o.event.title)).toEqual([
      'Early',
      'Late',
    ]);
  });
});

describe('repeating event edits', () => {
  it('skips one occurrence and undoes it', async () => {
    const e = await eventsRepo.create({ ...timed('2026-11-02'), rrule: rule('2026-11-02') });
    await eventsRepo.skipOccurrence(e.id, '2026-11-04');
    await eventsRepo.skipOccurrence(e.id, '2026-11-03');
    await eventsRepo.skipOccurrence(e.id, '2026-11-03');
    let stored = (await db.events.get(e.id))!;
    expect(stored.exdates).toEqual(['2026-11-03', '2026-11-04']);
    expect(occurrences(stored, '2026-11-02', '2026-11-05').map((o) => o.date)).toEqual([
      '2026-11-02',
      '2026-11-05',
    ]);

    await eventsRepo.unskipOccurrence(e.id, '2026-11-03');
    stored = (await db.events.get(e.id))!;
    expect(stored.exdates).toEqual(['2026-11-04']);
  });
});

describe('events in the Trash and search', () => {
  it('soft-deletes, restores and purges, keeping search in sync', async () => {
    const e = await eventsRepo.create({ ...timed('2026-11-02'), location: 'Library room 2' });
    expect(searchIndex.search('library').map((h) => h.id)).toContain(e.id);

    await eventsRepo.softDelete(e.id);
    expect(searchIndex.search('library')).toEqual([]);
    expect(await listTrash()).toMatchObject([
      { type: 'event', label: 'Event', title: 'Study group' },
    ]);

    await restoreFromTrash({ type: 'event', id: e.id });
    expect((await db.events.get(e.id))?.deletedAt).toBeNull();

    await eventsRepo.softDelete(e.id);
    await deleteForever({ type: 'event', id: e.id });
    expect(await db.events.get(e.id)).toBeUndefined();
    expect((await db.activity.toArray()).map((a) => a.type)).toEqual([
      'event.created',
      'event.deleted',
      'event.restored',
      'event.deleted',
      'event.purged',
    ]);
  });
});
