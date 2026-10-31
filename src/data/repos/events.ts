import {
  addLocalDays,
  daysBetween,
  isIsoDateTime,
  isLocalDate,
  localDateTimeToIso,
  parseLocalDate,
  splitIso,
} from '@/lib/dates';
import { occurrencesBetween, parseRecurrence } from '@/lib/recurrence';
import { z } from '@/lib/validation';
import { db } from '../db';
import { createRepository } from '../repository';
import type { CalendarEvent, LocalDate } from '../types';

const localDate = z.string().check(z.refine(isLocalDate, 'Pick a valid date'));
const nullable = <T extends z.ZodMiniType>(s: T) => z._default(z.nullable(s), null);

/** All-day events' reminders are counted back from this local time on their day. */
export const ALL_DAY_REMINDER_TIME = '09:00';

/** Reminders can be set up to four weeks ahead. */
export const MAX_REMINDER_MINUTES = 4 * 7 * 24 * 60;

type Timing = { start: string; end: string; allDay: 0 | 1 };
const validPoint = (value: string, allDay: 0 | 1) =>
  allDay ? isLocalDate(value) : isIsoDateTime(value);
const formatsOk = (e: Timing) => validPoint(e.start, e.allDay) && validPoint(e.end, e.allDay);

export const eventSchema = z
  .object({
    title: z
      .string()
      .check(
        z.trim(),
        z.minLength(1, 'Give your event a title'),
        z.maxLength(200, 'Keep the title under 200 characters'),
      ),
    description: z._default(
      z.string().check(z.maxLength(5000, 'Keep notes under 5,000 characters')),
      '',
    ),
    start: z.string(),
    end: z.string(),
    allDay: z._default(z.union([z.literal(0), z.literal(1)]), 0),
    location: z._default(
      z.string().check(z.trim(), z.maxLength(200, 'Keep the place under 200 characters')),
      '',
    ),
    categoryId: nullable(z.string()),
    tagIds: z._default(z.array(z.string()), []),
    rrule: nullable(
      z.string().check(z.refine((s) => parseRecurrence(s) !== null, 'Invalid repeat rule')),
    ),
    exdates: z._default(z.array(localDate), []),
    reminderMinutes: nullable(
      z
        .int()
        .check(
          z.minimum(0, 'Pick a valid reminder'),
          z.maximum(MAX_REMINDER_MINUTES, 'Pick an earlier reminder'),
        ),
    ),
  })
  .check(
    z.refine((e) => validPoint(e.start, e.allDay), {
      message: 'Pick a valid start',
      path: ['start'],
    }),
    z.refine((e) => validPoint(e.end, e.allDay), { message: 'Pick a valid end', path: ['end'] }),
    z.refine((e) => !formatsOk(e) || startMs(e) <= endMs(e), {
      message: "The event can't end before it starts",
      path: ['end'],
    }),
    // Repeats are anchored on the rule's DTSTART, so it must match the event's first day.
    z.refine(
      (e) => !e.rrule || !formatsOk(e) || parseRecurrence(e.rrule)?.start === startDateOf(e),
      { message: 'The repeat rule must start on the event date', path: ['rrule'] },
    ),
  );

export type EventInput = z.input<typeof eventSchema>;
type EventFields = z.output<typeof eventSchema>;

// ---------- timing helpers ----------

/** The local day an event (or its first occurrence) starts on. */
export const startDateOf = (e: Timing): LocalDate => (e.allDay ? e.start : splitIso(e.start).date);

const startMs = (e: Timing) => (e.allDay ? parseLocalDate(e.start).getTime() : Date.parse(e.start));
const endMs = (e: Timing) => (e.allDay ? parseLocalDate(e.end).getTime() : Date.parse(e.end));

interface Shape {
  date: LocalDate;
  /** Whole days from the first to the last day the event covers. */
  span: number;
  startTime: string | null;
  endTime: string | null;
}

function shapeOf(e: Timing): Shape {
  if (e.allDay)
    return { date: e.start, span: daysBetween(e.start, e.end), startTime: null, endTime: null };
  const s = splitIso(e.start);
  const end = splitIso(e.end);
  let span = daysBetween(s.date, end.date);
  // 22:00–00:00 ends at midnight: it doesn't cover the next day.
  if (span > 0 && end.time === '00:00') span -= 1;
  return { date: s.date, span, startTime: s.time, endTime: end.time };
}

/** One appearance of an event on the calendar. Repeating events have many. */
export interface EventOccurrence {
  /** Unique per occurrence: `${eventId}:${date}`. */
  key: string;
  event: CalendarEvent;
  /** First day of this occurrence. */
  date: LocalDate;
  /** Last day it covers (inclusive). Same as `date` for single-day events. */
  endDate: LocalDate;
  /** Local "HH:mm", or null for all-day events. */
  startTime: string | null;
  endTime: string | null;
  /** When this occurrence starts (local midnight for all-day). */
  startsAt: number;
}

function occurrenceOn(event: CalendarEvent, shape: Shape, date: LocalDate): EventOccurrence {
  return {
    key: `${event.id}:${date}`,
    event,
    date,
    endDate: addLocalDays(date, shape.span),
    startTime: shape.startTime,
    endTime: shape.endTime,
    startsAt: shape.startTime
      ? Date.parse(localDateTimeToIso(date, shape.startTime))
      : parseLocalDate(date).getTime(),
  };
}

/**
 * Occurrences of one event that touch the days `from`..`to` (inclusive), including
 * multi-day occurrences that started earlier. Repeats are expanded from the rule's anchor
 * and `exdates` are left out.
 */
export function occurrences(
  event: CalendarEvent,
  from: LocalDate,
  to: LocalDate,
): EventOccurrence[] {
  const shape = shapeOf(event);
  const rule = event.rrule ? parseRecurrence(event.rrule) : null;
  if (!rule) {
    const last = addLocalDays(shape.date, shape.span);
    return shape.date <= to && last >= from ? [occurrenceOn(event, shape, shape.date)] : [];
  }
  const skip = new Set(event.exdates);
  return occurrencesBetween(rule, addLocalDays(from, -shape.span), to)
    .filter((d) => !skip.has(d))
    .map((d) => occurrenceOn(event, shape, d));
}

/** All occurrences of many events in a range, earliest first. */
export function expandEvents(events: CalendarEvent[], from: LocalDate, to: LocalDate) {
  return events
    .filter((e) => !e.deletedAt)
    .flatMap((e) => occurrences(e, from, to))
    .sort((a, b) => a.startsAt - b.startsAt);
}

// ---------- repository ----------

const base = createRepository<CalendarEvent, EventFields, EventInput>({
  entityType: 'event',
  table: () => db.events,
  schema: eventSchema,
  toSearch: (e) => ({
    title: e.title,
    body: [e.location, e.description].filter(Boolean).join('\n'),
  }),
});

export const eventsRepo = {
  ...base,

  /** "Delete this event only" for a repeating event: hides one occurrence. */
  async skipOccurrence(id: string, date: LocalDate): Promise<CalendarEvent> {
    const event = await db.events.get(id);
    const exdates = new Set(event?.exdates ?? []);
    exdates.add(date);
    return base.update(id, { exdates: [...exdates].sort() });
  },

  /** Undo for `skipOccurrence`. */
  async unskipOccurrence(id: string, date: LocalDate): Promise<CalendarEvent> {
    const event = await db.events.get(id);
    return base.update(id, { exdates: (event?.exdates ?? []).filter((d) => d !== date) });
  },
};
