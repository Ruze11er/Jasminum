import type { ReactNode } from 'react';
import { CalendarPlus, Clock, ListPlus, MapPin, Repeat } from 'lucide-react';
import { Button, Chip } from '@/design-system';
import type { Category, LocalDate } from '@/data/types';
import { cn } from '@/lib/cn';
import { dayLabel } from '@/lib/dates';
import { TaskItem } from '@/features/tasks/components/TaskItem';
import { useTaskEditor } from '@/features/tasks/editorStore';
import { useEventEditor } from '../eventEditorStore';
import { barColorClasses, categoryColor, whenText, type EventItem } from '../display';
import type { CalendarData } from '../useCalendarData';

function Meta({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 [&>svg]:size-3.5">
      {icon}
      {children}
    </span>
  );
}

/** One event occurrence in a list. Opens the event form. */
export function EventRow({
  item,
  today,
  category,
}: {
  item: EventItem;
  today: LocalDate;
  category?: Category;
}) {
  const openEdit = useEventEditor((s) => s.openEdit);
  const { occ } = item;
  const when = whenText(item, today);

  return (
    <li>
      <button
        type="button"
        onClick={() => openEdit(occ.event.id, occ.date)}
        aria-label={`Edit event: ${occ.event.title}`}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted md:px-5"
      >
        <span
          aria-hidden="true"
          className={cn(
            'mt-0.5 h-10 w-1.5 shrink-0 rounded-full',
            barColorClasses[categoryColor(category)],
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold break-words">{occ.event.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-semibold text-fg-muted">
            <Meta icon={<Clock aria-hidden="true" />}>{when}</Meta>
            {occ.event.location && (
              <Meta icon={<MapPin aria-hidden="true" />}>{occ.event.location}</Meta>
            )}
            {occ.event.rrule && (
              <Meta icon={<Repeat aria-hidden="true" />}>
                <span className="sr-only">Repeats</span>
              </Meta>
            )}
            {category && (
              <Chip color={categoryColor(category)} className="h-6 text-xs">
                {category.name}
              </Chip>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

/** Everything on one day: events and tasks, with buttons to add more. */
export function DayAgenda({
  date,
  today,
  data,
}: {
  date: LocalDate;
  today: LocalDate;
  data: CalendarData;
}) {
  const openEvent = useEventEditor((s) => s.openNew);
  const openTask = useTaskEditor((s) => s.openNew);
  const openTaskEdit = useTaskEditor((s) => s.openEdit);
  const items = data.byDay.get(date) ?? [];
  const label = dayLabel(date, today);
  const headingId = `agenda-${date}`;

  return (
    <section aria-labelledby={headingId}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 id={headingId} className="min-w-0 flex-1 text-lg">
          {label}
        </h2>
        <Button
          variant="secondary"
          size="sm"
          icon={<CalendarPlus />}
          onClick={() => openEvent({ date })}
          aria-label={`Add event on ${label}`}
        >
          Event
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<ListPlus />}
          onClick={() => openTask({ dueDate: date })}
          aria-label={`Add task on ${label}`}
        >
          Task
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-fg-muted">
          Nothing planned.
        </p>
      ) : (
        <ul
          aria-label={`Plans for ${label}`}
          className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-soft-sm"
        >
          {items.map((item) =>
            item.kind === 'event' ? (
              <EventRow
                key={item.key}
                item={item}
                today={today}
                category={
                  item.occ.event.categoryId
                    ? data.categoryById.get(item.occ.event.categoryId)
                    : undefined
                }
              />
            ) : (
              <TaskItem
                key={item.key}
                task={item.task}
                today={today}
                hideDate
                category={
                  item.task.categoryId ? data.categoryById.get(item.task.categoryId) : undefined
                }
                tagById={data.tagById}
                checklist={data.checklistByTask.get(item.task.id)}
                onOpen={(t) => openTaskEdit(t.id)}
              />
            ),
          )}
        </ul>
      )}
    </section>
  );
}
