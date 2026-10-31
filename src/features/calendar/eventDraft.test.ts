import { describe, expect, it } from 'vitest';
import { eventsRepo } from '@/data/repos/events';
import { localDateTimeToIso } from '@/lib/dates';
import { addMinutes, draftFromEvent, draftToInput, moveStart, newDraft } from './eventDraft';

const at = (date: string, time: string) => new Date(`${date}T${time}:00`).getTime();

describe('event form drafts', () => {
  it('starts a new event today at the next full hour, for one hour', () => {
    const d = newDraft({}, at('2026-11-02', '14:20'));
    expect(d).toMatchObject({
      allDay: false,
      startDate: '2026-11-02',
      startTime: '15:00',
      endDate: '2026-11-02',
      endTime: '16:00',
      reminder: '',
    });
  });

  it('rolls a late-evening new event over midnight', () => {
    const d = newDraft({}, at('2026-11-02', '23:10'));
    expect(d).toMatchObject({
      startDate: '2026-11-03',
      startTime: '00:00',
      endDate: '2026-11-03',
      endTime: '01:00',
    });
  });

  it('uses 9:00 on another chosen day, and whole days for all-day events', () => {
    expect(newDraft({ date: '2026-11-10' }, at('2026-11-02', '14:20'))).toMatchObject({
      startDate: '2026-11-10',
      startTime: '09:00',
      endTime: '10:00',
    });
    expect(newDraft({ date: '2026-11-10', allDay: true }, at('2026-11-02', '14:20'))).toMatchObject(
      { allDay: true, startDate: '2026-11-10', endDate: '2026-11-10' },
    );
  });

  it('adds minutes across midnight', () => {
    expect(addMinutes('2026-11-02', '23:30', 45)).toEqual({ date: '2026-11-03', time: '00:15' });
  });

  it('moves the end with the start so the length stays the same', () => {
    const d = newDraft({ date: '2026-11-10' }, at('2026-11-02', '08:00')); // 09:00–10:00
    expect(moveStart(d, { startTime: '13:30' })).toMatchObject({
      startTime: '13:30',
      endDate: '2026-11-10',
      endTime: '14:30',
    });
    expect(moveStart(d, { startDate: '2026-11-12' })).toMatchObject({
      endDate: '2026-11-12',
      endTime: '10:00',
    });
    const trip = { ...newDraft({ date: '2026-11-10', allDay: true }, 0), endDate: '2026-11-12' };
    expect(moveStart(trip, { startDate: '2026-11-20' })).toMatchObject({ endDate: '2026-11-22' });
  });

  it('gives a backwards event one hour when the start moves', () => {
    const d = { ...newDraft({ date: '2026-11-10' }, 0), endTime: '08:00' };
    expect(moveStart(d, { startTime: '11:00' })).toMatchObject({ endTime: '12:00' });
  });

  it('round-trips through a saved event', async () => {
    const draft = {
      ...newDraft({ date: '2026-11-10' }, 0),
      title: 'Piano lesson',
      location: 'Music school',
      reminder: '15',
      repeat: {
        preset: 'weekly' as const,
        interval: 1,
        unit: 'WEEKLY' as const,
        byDay: [],
        until: null,
      },
    };
    const input = draftToInput(draft, ['tag-1']);
    expect(input).toMatchObject({
      allDay: 0,
      start: localDateTimeToIso('2026-11-10', '09:00'),
      end: localDateTimeToIso('2026-11-10', '10:00'),
      reminderMinutes: 15,
      tagIds: ['tag-1'],
    });
    expect(input.rrule).toContain('DTSTART;VALUE=DATE:20261110');

    const saved = await eventsRepo.create(input);
    expect(draftFromEvent(saved, [])).toMatchObject({
      title: 'Piano lesson',
      startDate: '2026-11-10',
      startTime: '09:00',
      endTime: '10:00',
      reminder: '15',
      repeat: { preset: 'weekly' },
    });
  });
});
