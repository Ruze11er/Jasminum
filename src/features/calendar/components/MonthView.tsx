import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { WeekStart } from '@/data/repos/settings';
import type { LocalDate } from '@/data/types';
import { cn } from '@/lib/cn';
import { addLocalDays } from '@/lib/dates';
import {
  fullDayLabel,
  monthGrid,
  sameMonth,
  shiftDate,
  weekdayLabels,
  type CalendarItem,
} from '../selectors';
import type { CalendarData } from '../useCalendarData';
import { itemColorClasses } from '../display';

const MAX_CHIPS = 3;

/** Month grid. Tapping a day selects it; the page shows that day's plans underneath. */
export function MonthView({
  cursor,
  today,
  weekStartsOn,
  data,
  onSelect,
}: {
  cursor: LocalDate;
  today: LocalDate;
  weekStartsOn: WeekStart;
  data: CalendarData;
  onSelect: (date: LocalDate) => void;
}) {
  const weeks = monthGrid(cursor, weekStartsOn);
  const gridRef = useRef<HTMLDivElement>(null);
  const moveFocus = useRef(false);

  // After arrow-key navigation, keep keyboard focus on the newly selected day.
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${cursor}"]`)?.focus();
  }, [cursor]);

  const onKeyDown = (e: KeyboardEvent, day: LocalDate) => {
    const steps: Record<string, () => LocalDate> = {
      ArrowLeft: () => addLocalDays(day, -1),
      ArrowRight: () => addLocalDays(day, 1),
      ArrowUp: () => addLocalDays(day, -7),
      ArrowDown: () => addLocalDays(day, 7),
      PageUp: () => shiftDate('month', day, -1),
      PageDown: () => shiftDate('month', day, 1),
    };
    const next = steps[e.key]?.();
    if (!next) return;
    e.preventDefault();
    moveFocus.current = true;
    onSelect(next);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft-sm">
      <div className="grid grid-cols-7 border-b border-line bg-surface-muted" aria-hidden="true">
        {weekdayLabels(weekStartsOn).map((d) => (
          <div key={d} className="py-2 text-center text-xs font-bold text-fg-muted uppercase">
            {d}
          </div>
        ))}
      </div>
      <div ref={gridRef} role="group" aria-label="Days" className="grid grid-cols-7">
        {weeks.flat().map((day, i) => {
          const items = data.byDay.get(day) ?? [];
          const inMonth = sameMonth(day, cursor);
          const selected = day === cursor;
          const isToday = day === today;
          const count = items.length;
          return (
            <button
              key={day}
              type="button"
              data-date={day}
              tabIndex={selected ? 0 : -1}
              aria-pressed={selected}
              aria-current={isToday ? 'date' : undefined}
              aria-label={`${fullDayLabel(day)}${isToday ? ', today' : ''}${count ? `, ${count} ${count === 1 ? 'item' : 'items'}` : ''}`}
              onClick={() => onSelect(day)}
              onKeyDown={(e) => onKeyDown(e, day)}
              className={cn(
                'flex min-h-14 flex-col items-center gap-1 border-line p-1 text-left transition-colors md:min-h-28 md:items-stretch md:p-1.5',
                i % 7 !== 6 && 'border-r',
                i < weeks.length * 7 - 7 && 'border-b',
                selected ? 'bg-primary-soft/60' : 'hover:bg-surface-muted',
                !inMonth && !selected && 'bg-surface-muted/50',
              )}
            >
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                  isToday ? 'bg-primary text-on-primary' : inMonth ? 'text-fg' : 'text-fg-muted',
                )}
              >
                {Number(day.slice(8))}
              </span>
              {count > 0 && <DayPreview items={items} data={data} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Dots on phones, title chips on larger screens. Decorative: the day's label has the count. */
function DayPreview({ items, data }: { items: CalendarItem[]; data: CalendarData }) {
  const color = (item: CalendarItem) => itemColorClasses(item, data.categoryById);
  const extra = items.length - MAX_CHIPS;
  return (
    <span aria-hidden="true" className="contents">
      <span className="flex gap-0.5 md:hidden">
        {items.slice(0, MAX_CHIPS).map((item) => (
          <span
            key={item.key}
            className={cn(
              'size-1.5 rounded-full',
              item.kind === 'event' ? 'bg-primary' : 'bg-fg-muted',
            )}
          />
        ))}
      </span>
      <span className="hidden min-w-0 flex-col gap-0.5 md:flex">
        {items.slice(0, MAX_CHIPS).map((item) => (
          <span
            key={item.key}
            className={cn(
              'truncate rounded-md px-1.5 py-0.5 text-xs font-semibold',
              color(item),
              item.kind === 'task' && item.task.status === 'done' && 'line-through opacity-70',
            )}
          >
            {item.title}
          </span>
        ))}
        {extra > 0 && (
          <span className="px-1.5 text-xs font-semibold text-fg-muted">+{extra} more</span>
        )}
      </span>
    </span>
  );
}
