import { useSearchParams } from 'react-router';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button, IconButton, PageHeader, SegmentedControl } from '@/design-system';
import { useSetting } from '@/data/repos/settings';
import type { LocalDate } from '@/data/types';
import { clock } from '@/lib/clock';
import { localDateOf } from '@/lib/dates';
import { DayAgenda } from './components/DayAgenda';
import { MonthView } from './components/MonthView';
import { WeekView } from './components/WeekView';
import { useEventEditor } from './eventEditorStore';
import {
  isCalendarView,
  parseCursor,
  rangeTitle,
  shiftDate,
  visibleRange,
  type CalendarView,
} from './selectors';
import { useCalendarData } from './useCalendarData';

export default function CalendarPage() {
  const today = localDateOf(clock.now());
  // The view and date live in the URL, so reloads and Back keep your place.
  const [params, setParams] = useSearchParams();
  const view: CalendarView = isCalendarView(params.get('view'))
    ? (params.get('view') as CalendarView)
    : 'month';
  const cursor = parseCursor(params.get('date'), today);
  const weekStartsOn = useSetting('weekStartsOn');
  const { from, to } = visibleRange(view, cursor, weekStartsOn);
  const data = useCalendarData(from, to);
  const openEvent = useEventEditor((s) => s.openNew);

  const go = (next: { view?: CalendarView; date?: LocalDate }) => {
    const p = new URLSearchParams(params);
    p.set('view', next.view ?? view);
    p.set('date', next.date ?? cursor);
    setParams(p, { replace: true });
  };

  const title = rangeTitle(view, cursor, weekStartsOn);

  return (
    <>
      <PageHeader
        title="Calendar"
        actions={
          <SegmentedControl
            label="Calendar view"
            value={view}
            onChange={(v) => go({ view: v })}
            options={[
              { value: 'day', label: 'Day' },
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
            ]}
          />
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <IconButton
          label={`Previous ${view}`}
          icon={<ChevronLeft />}
          onClick={() => go({ date: shiftDate(view, cursor, -1) })}
        />
        <IconButton
          label={`Next ${view}`}
          icon={<ChevronRight />}
          onClick={() => go({ date: shiftDate(view, cursor, 1) })}
        />
        <h2 aria-live="polite" className="min-w-0 flex-1 text-lg md:text-xl">
          {title}
        </h2>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => go({ date: today })}
          disabled={cursor === today}
        >
          Today
        </Button>
        <Button
          size="sm"
          icon={<Plus />}
          onClick={() => openEvent({ date: cursor })}
          className="max-md:hidden"
        >
          New event
        </Button>
      </div>

      {!data ? (
        <div
          aria-busy="true"
          aria-label="Loading calendar"
          className="h-80 animate-pulse rounded-2xl bg-surface-muted"
        />
      ) : view === 'month' ? (
        <div className="space-y-6">
          <MonthView
            cursor={cursor}
            today={today}
            weekStartsOn={weekStartsOn}
            data={data}
            onSelect={(date) => go({ date })}
          />
          <DayAgenda date={cursor} today={today} data={data} />
        </div>
      ) : view === 'week' ? (
        <WeekView
          cursor={cursor}
          today={today}
          weekStartsOn={weekStartsOn}
          data={data}
          onOpenDay={(date) => go({ view: 'day', date })}
        />
      ) : (
        <DayAgenda date={cursor} today={today} data={data} />
      )}
    </>
  );
}
