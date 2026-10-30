import { useId } from 'react';
import { Select } from '@/design-system';
import type { LocalDate } from '@/data/types';
import { cn } from '@/lib/cn';
import { WEEKDAYS, type Frequency, type Weekday } from '@/lib/recurrence';
import { presetLabels, weekdayOf, type RepeatPreset, type RepeatState } from '../repeat';

const UNIT_LABELS: Record<Frequency, [string, string]> = {
  DAILY: ['day', 'days'],
  WEEKLY: ['week', 'weeks'],
  MONTHLY: ['month', 'months'],
  YEARLY: ['year', 'years'],
};

const DAY_SHORT: Record<Weekday, string> = {
  MO: 'M',
  TU: 'T',
  WE: 'W',
  TH: 'T',
  FR: 'F',
  SA: 'S',
  SU: 'S',
};
const DAY_LONG: Record<Weekday, string> = {
  MO: 'Monday',
  TU: 'Tuesday',
  WE: 'Wednesday',
  TH: 'Thursday',
  FR: 'Friday',
  SA: 'Saturday',
  SU: 'Sunday',
};

export function RepeatPicker({
  id,
  value,
  onChange,
  dueDate,
}: {
  id: string;
  value: RepeatState;
  onChange: (value: RepeatState) => void;
  dueDate: LocalDate | null;
}) {
  const labels = presetLabels(dueDate);
  const intervalId = useId();
  const unitId = useId();

  const choosePreset = (preset: RepeatPreset) => {
    if (preset === 'custom' && value.preset !== 'custom') {
      // Start custom from a sensible weekly rule on the task's weekday.
      onChange({
        ...value,
        preset,
        interval: 1,
        unit: 'WEEKLY',
        byDay: dueDate ? [weekdayOf(dueDate)] : [],
      });
    } else {
      onChange({ ...value, preset });
    }
  };

  const toggleDay = (day: Weekday) => {
    const byDay = value.byDay.includes(day)
      ? value.byDay.filter((d) => d !== day)
      : [...value.byDay, day];
    onChange({ ...value, byDay: WEEKDAYS.filter((d) => byDay.includes(d)) });
  };

  return (
    <div className="space-y-3">
      <Select
        id={id}
        value={value.preset}
        onChange={(e) => choosePreset(e.target.value as RepeatPreset)}
      >
        {(Object.keys(labels) as RepeatPreset[]).map((p) => (
          <option key={p} value={p}>
            {labels[p]}
          </option>
        ))}
      </Select>

      {value.preset !== 'none' && !dueDate && (
        <p className="text-sm text-fg-muted">Repeating tasks start from today if no date is set.</p>
      )}

      {value.preset === 'custom' && (
        <div className="space-y-3 rounded-xl bg-surface-muted p-3">
          <div className="flex items-center gap-2">
            <label htmlFor={intervalId} className="text-sm font-semibold">
              Every
            </label>
            <input
              id={intervalId}
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              value={value.interval}
              onChange={(e) => onChange({ ...value, interval: Number(e.target.value) })}
              className="h-10 w-16 rounded-lg border-[1.5px] border-line bg-surface px-2 text-center outline-none focus:border-brand"
            />
            <label htmlFor={unitId} className="sr-only">
              Unit
            </label>
            <Select
              id={unitId}
              className="flex-1"
              value={value.unit}
              onChange={(e) => onChange({ ...value, unit: e.target.value as Frequency })}
            >
              {(Object.keys(UNIT_LABELS) as Frequency[]).map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABELS[u][value.interval === 1 ? 0 : 1]}
                </option>
              ))}
            </Select>
          </div>
          {value.unit === 'WEEKLY' && (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">On</legend>
              <div className="flex gap-1.5">
                {WEEKDAYS.map((day) => {
                  const on = value.byDay.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={on}
                      aria-label={DAY_LONG[day]}
                      onClick={() => toggleDay(day)}
                      className={cn(
                        'flex size-9 items-center justify-center rounded-full text-sm font-bold transition-colors max-md:size-10',
                        on
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface text-fg-muted hover:text-fg',
                      )}
                    >
                      {DAY_SHORT[day]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
        </div>
      )}
    </div>
  );
}
