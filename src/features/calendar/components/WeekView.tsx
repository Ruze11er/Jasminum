import type { WeekStart } from '@/data/repos/settings';
import type { LocalDate } from '@/data/types';
import { cn } from '@/lib/cn';
import { timeLabel } from '@/lib/dates';
import { useIsDesktop } from '@/lib/useMediaQuery';
import { useTaskEditor } from '@/features/tasks/editorStore';
import { useEventEditor } from '../eventEditorStore';
import { fullDayLabel, weekDays, weekdayLabels } from '../selectors';
import type { CalendarData } from '../useCalendarData';
import { itemColorClasses } from '../display';
import { DayAgenda } from './DayAgenda';

/**
 * Seven columns on larger screens; on phones, the week as a list of days (easier to read
 * and tap than seven narrow columns).
 */
export function WeekView({
  cursor,
  today,
  weekStartsOn,
  data,
  onOpenDay,
}: {
  cursor: LocalDate;
  today: LocalDate;
  weekStartsOn: WeekStart;
  data: CalendarData;
  onOpenDay: (date: LocalDate) => void;
}) {
  const desktop = useIsDesktop();
  const days = weekDays(cursor, weekStartsOn);

  if (!desktop) {
    return (
      <div className="space-y-6">
        {days.map((day) => (
          <DayAgenda key={day} date={day} today={today} data={data} />
        ))}
      </div>
    );
  }

  const labels = weekdayLabels(weekStartsOn);
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day, i) => (
        <WeekColumn
          key={day}
          day={day}
          weekday={labels[i]!}
          isToday={day === today}
          data={data}
          onOpenDay={onOpenDay}
        />
      ))}
    </div>
  );
}

function WeekColumn({
  day,
  weekday,
  isToday,
  data,
  onOpenDay,
}: {
  day: LocalDate;
  weekday: string;
  isToday: boolean;
  data: CalendarData;
  onOpenDay: (date: LocalDate) => void;
}) {
  const openEvent = useEventEditor((s) => s.openEdit);
  const openTask = useTaskEditor((s) => s.openEdit);
  const items = data.byDay.get(day) ?? [];
  return (
    <section
      aria-label={fullDayLabel(day)}
      className={cn(
        'flex min-h-64 min-w-0 flex-col rounded-2xl border bg-surface p-2 shadow-soft-sm',
        isToday ? 'border-primary' : 'border-line',
      )}
    >
      <button
        type="button"
        onClick={() => onOpenDay(day)}
        aria-label={`Open ${fullDayLabel(day)}`}
        aria-current={isToday ? 'date' : undefined}
        className="mb-2 flex flex-col items-center rounded-xl py-1 hover:bg-surface-muted"
      >
        <span className="text-xs font-bold text-fg-muted uppercase">{weekday}</span>
        <span
          className={cn(
            'flex size-8 items-center justify-center rounded-full text-lg font-bold',
            isToday && 'bg-primary text-on-primary',
          )}
        >
          {Number(day.slice(8))}
        </span>
      </button>
      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const event = item.kind === 'event';
          const color = itemColorClasses(item, data.categoryById);
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() =>
                  event ? openEvent(item.occ.event.id, item.occ.date) : openTask(item.task.id)
                }
                aria-label={`Edit ${event ? 'event' : 'task'}: ${item.title}`}
                className={cn(
                  'w-full rounded-lg px-2 py-1 text-left text-xs font-semibold transition-shadow hover:shadow-soft-md',
                  color,
                  !event && item.task.status === 'done' && 'line-through opacity-70',
                )}
              >
                {item.time && <span className="block font-bold">{timeLabel(item.time)}</span>}
                <span className="line-clamp-2 break-words">{item.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
