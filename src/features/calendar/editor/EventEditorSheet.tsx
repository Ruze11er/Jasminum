import { useId, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { MapPin, Trash2 } from 'lucide-react';
import { Button, Checkbox, Field, Input, Select, Sheet, Textarea, toast } from '@/design-system';
import { db } from '@/data/db';
import { eventsRepo } from '@/data/repos/events';
import { tagsRepo } from '@/data/repos/tags';
import type { CalendarEvent, Category, LocalDate, Tag } from '@/data/types';
import { clock } from '@/lib/clock';
import { dayLabel, localDateOf } from '@/lib/dates';
import { firstIssue } from '@/lib/validation';
import { CategoryPicker } from '@/features/tasks/editor/CategoryPicker';
import { RepeatPicker } from '@/features/tasks/editor/RepeatPicker';
import { TagInput } from '@/features/tasks/editor/TagInput';
import { LinkedNotes } from '@/features/notes/LinkedNotes';
import { deleteEvent, deleteOccurrence } from '../eventActions';
import {
  draftFromEvent,
  draftToInput,
  moveStart,
  newDraft,
  reminderOptions,
  setAllDay,
  type EventDraft,
} from '../eventDraft';
import { useEventEditor } from '../eventEditorStore';

interface Loaded {
  event: CalendarEvent | null;
  draft: EventDraft;
  categories: Category[];
  tags: Tag[];
}

/** Create/edit form for a calendar event, opened through `useEventEditor`. Loaded lazily. */
export default function EventEditorSheet() {
  const { open, eventId, occurrenceDate, defaults, close } = useEventEditor();

  const loaded = useLiveQuery(async (): Promise<Loaded | null> => {
    const [categories, tags] = await Promise.all([
      db.categories
        .orderBy('order')
        .filter((c) => !c.deletedAt)
        .toArray(),
      db.tags
        .orderBy('normalizedName')
        .filter((t) => !t.deletedAt)
        .toArray(),
    ]);
    if (!eventId) return { event: null, categories, tags, draft: newDraft(defaults, clock.now()) };
    const event = await db.events.get(eventId);
    if (!event || event.deletedAt) return null;
    const tagById = new Map(tags.map((t) => [t.id, t.name]));
    const tagNames = event.tagIds.map((id) => tagById.get(id)).filter((n): n is string => !!n);
    return { event, categories, tags, draft: draftFromEvent(event, tagNames) };
  }, [eventId, defaults]);

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && close()}
      title={eventId ? 'Edit event' : 'New event'}
      className="md:max-w-xl"
    >
      {loaded === null ? (
        <p className="py-6 text-center text-fg-muted">This event no longer exists.</p>
      ) : loaded ? (
        <EventForm
          key={eventId ?? 'new'}
          {...loaded}
          occurrenceDate={occurrenceDate}
          onDone={close}
        />
      ) : null}
    </Sheet>
  );
}

function EventForm({
  event,
  draft: initial,
  categories,
  tags,
  occurrenceDate,
  onDone,
}: Loaded & { occurrenceDate: LocalDate | null; onDone: () => void }) {
  const [draft, setDraft] = useState<EventDraft>(initial);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const ids = {
    startDate: useId(),
    startTime: useId(),
    endDate: useId(),
    endTime: useId(),
    category: useId(),
    repeat: useId(),
    reminder: useId(),
    tags: useId(),
  };
  const repeating = !!event?.rrule;
  const options = reminderOptions(draft.allDay);

  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      const tagIds = (await Promise.all(draft.tagNames.map((n) => tagsRepo.ensure(n)))).map(
        (t) => t.id,
      );
      const input = draftToInput(draft, tagIds);
      if (event) await eventsRepo.update(event.id, input);
      else await eventsRepo.create(input);
      toast({ message: event ? 'Event saved' : 'Event added' });
      onDone();
    } catch (err) {
      setError(firstIssue(err) ?? "Couldn't save the event. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="space-y-5"
    >
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-semibold text-danger"
        >
          {error}
        </p>
      )}

      <Field label="Title">
        {(p) => (
          <Input
            {...p}
            autoFocus={!event}
            value={draft.title}
            maxLength={200}
            placeholder="What's happening?"
            onChange={(e) => set('title', e.target.value)}
          />
        )}
      </Field>

      <div className="space-y-3">
        <Checkbox
          label="All day"
          checked={draft.allDay}
          onChange={(e) => {
            const allDay = e.target.checked;
            setDraft((d) => setAllDay(d, allDay));
          }}
        />
        <DateTimeRow
          label="Starts"
          dateId={ids.startDate}
          timeId={ids.startTime}
          date={draft.startDate}
          time={draft.startTime}
          allDay={draft.allDay}
          onDate={(v) => setDraft((d) => moveStart(d, { startDate: v }))}
          onTime={(v) => setDraft((d) => moveStart(d, { startTime: v }))}
        />
        <DateTimeRow
          label="Ends"
          dateId={ids.endDate}
          timeId={ids.endTime}
          date={draft.endDate}
          time={draft.endTime}
          allDay={draft.allDay}
          onDate={(v) => set('endDate', v)}
          onTime={(v) => set('endTime', v)}
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Section label="Repeat" htmlFor={ids.repeat}>
          <RepeatPicker
            id={ids.repeat}
            value={draft.repeat}
            onChange={(v) => set('repeat', v)}
            dueDate={draft.startDate || null}
          />
        </Section>
        <Section label="Reminder" htmlFor={ids.reminder}>
          <Select
            id={ids.reminder}
            value={draft.reminder}
            onChange={(e) => set('reminder', e.target.value)}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          {draft.reminder !== '' && (
            <p className="mt-1.5 text-sm text-fg-muted">Reminders show while Jasminum is open.</p>
          )}
        </Section>
      </div>

      <Field label="Place">
        {(p) => (
          <Input
            {...p}
            leadingIcon={<MapPin />}
            value={draft.location}
            maxLength={200}
            placeholder="Optional"
            onChange={(e) => set('location', e.target.value)}
          />
        )}
      </Field>

      <div className="grid gap-5 md:grid-cols-2">
        <Section label="Category" htmlFor={ids.category}>
          <CategoryPicker
            id={ids.category}
            value={draft.categoryId}
            onChange={(v) => set('categoryId', v)}
            categories={categories}
          />
        </Section>
        <Section label="Tags" htmlFor={ids.tags}>
          <TagInput
            id={ids.tags}
            value={draft.tagNames}
            onChange={(v) => set('tagNames', v)}
            suggestions={tags.map((t) => t.name)}
          />
        </Section>
      </div>

      <Field label="Notes">
        {(p) => (
          <Textarea
            {...p}
            value={draft.description}
            maxLength={5000}
            placeholder="Details, links, anything helpful"
            onChange={(e) => set('description', e.target.value)}
          />
        )}
      </Field>

      {repeating && (
        <p className="text-sm text-fg-muted">Changes apply to every repeat of this event.</p>
      )}

      {event && <LinkedNotes item={{ type: 'event', id: event.id }} onOpen={onDone} />}

      {/* Sticky so Save is always reachable in a long form. */}
      <div className="sticky -bottom-4 z-10 -mx-5 flex flex-wrap items-center gap-2 border-t border-line bg-surface-raised px-5 pt-3 pb-4 md:-bottom-6 md:-mx-6 md:px-6 md:pb-6">
        {event && confirmDelete ? (
          // Repeating events: delete one day or the whole series.
          <div role="group" aria-label="Delete repeating event" className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                onDone();
                void deleteOccurrence(event, occurrenceDate!);
              }}
            >
              Only {dayLabel(occurrenceDate!, localDateOf(clock.now()))}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                onDone();
                void deleteEvent(event);
              }}
            >
              All repeats
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
              Keep
            </Button>
          </div>
        ) : (
          <>
            {event && (
              <Button
                variant="ghost"
                icon={<Trash2 />}
                className="text-danger hover:text-danger"
                onClick={() => {
                  if (repeating && occurrenceDate) {
                    setConfirmDelete(true);
                    return;
                  }
                  onDone();
                  void deleteEvent(event);
                }}
              >
                Delete
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={onDone}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {event ? 'Save' : 'Add event'}
              </Button>
            </div>
          </>
        )}
      </div>
    </form>
  );
}

function DateTimeRow({
  label,
  dateId,
  timeId,
  date,
  time,
  allDay,
  onDate,
  onTime,
}: {
  label: string;
  dateId: string;
  timeId: string;
  date: string;
  time: string;
  allDay: boolean;
  onDate: (v: string) => void;
  onTime: (v: string) => void;
}) {
  return (
    // minmax(0, …) and min-w-0 let native date/time inputs shrink on narrow phones.
    <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
      <label htmlFor={dateId} className="text-sm font-semibold">
        {label}
      </label>
      <Input
        id={dateId}
        type="date"
        value={date}
        onChange={(e) => onDate(e.target.value)}
        className={allDay ? 'col-span-2 min-w-0 px-2.5' : 'min-w-0 px-2.5'}
      />
      {!allDay && (
        <>
          <label htmlFor={timeId} className="sr-only">
            {label} at
          </label>
          <Input
            id={timeId}
            type="time"
            value={time}
            onChange={(e) => onTime(e.target.value)}
            className="min-w-0 px-2.5"
          />
        </>
      )}
    </div>
  );
}

function Section({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  const Tag = htmlFor ? 'label' : 'p';
  return (
    <div>
      <Tag {...(htmlFor ? { htmlFor } : {})} className="mb-1.5 block text-sm font-semibold">
        {label}
      </Tag>
      {children}
    </div>
  );
}
