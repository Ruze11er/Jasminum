import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { Card, CardHeader } from '@/design-system';
import { db } from '@/data/db';
import { expandEvents } from '@/data/repos/events';
import type { LocalDate } from '@/data/types';
import { cn } from '@/lib/cn';
import { timeLabel } from '@/lib/dates';
import { barColorClasses, categoryColor } from '@/features/calendar/display';
import { useEventEditor } from '@/features/calendar/eventEditorStore';

/** Today's events, earliest first. Tap one to open it. */
export function ScheduleCard({ today }: { today: LocalDate }) {
  const openEvent = useEventEditor((s) => s.openEdit);
  const data = useLiveQuery(async () => {
    const [events, categories] = await Promise.all([
      db.events.filter((e) => !e.deletedAt).toArray(),
      db.categories.toArray(),
    ]);
    return {
      occurrences: expandEvents(events, today, today),
      categoryById: new Map(categories.map((c) => [c.id, c])),
    };
  }, [today]);

  return (
    <Card>
      <CardHeader
        title="Schedule"
        icon={<CalendarDays />}
        action={
          <Link
            to="/calendar"
            className="flex items-center gap-0.5 text-sm font-bold text-link hover:underline"
          >
            Calendar
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        }
      />
      {!data ? (
        <div aria-busy="true" className="h-16" />
      ) : data.occurrences.length === 0 ? (
        <p className="py-3 text-sm text-fg-muted">No events today.</p>
      ) : (
        <ul aria-label="Today's events" className="space-y-1">
          {data.occurrences.map((occ) => {
            const category = occ.event.categoryId
              ? data.categoryById.get(occ.event.categoryId)
              : undefined;
            const time = occ.startTime && occ.date === today ? timeLabel(occ.startTime) : 'All day';
            return (
              <li key={occ.key}>
                <button
                  type="button"
                  onClick={() => openEvent(occ.event.id, occ.date)}
                  aria-label={`Edit event: ${occ.event.title}`}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-muted max-md:min-h-11"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'h-8 w-1.5 shrink-0 rounded-full',
                      barColorClasses[categoryColor(category)],
                    )}
                  />
                  <span className="w-16 shrink-0 text-xs font-bold text-fg-muted">{time}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{occ.event.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
