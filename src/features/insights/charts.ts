import type { WeekStart } from '@/data/repos/settings';
import type { Category, LocalDate, Task } from '@/data/types';
import { addLocalDays, localDateOf, parseLocalDate } from '@/lib/dates';
import { startOfWeek } from '@/features/calendar/selectors';

/** One bar: what it is, how many, and an accessible description. */
export interface Bar {
  key: string;
  label: string;
  value: number;
  /** Full description for screen readers and tooltips, e.g. "Week of Oct 26: 5 tasks". */
  description: string;
  /** The current period (highlighted in the label). */
  current?: boolean;
}

const doneDays = (tasks: Task[]) =>
  tasks
    .filter((t) => t.status === 'done' && !t.deletedAt && t.completedAt !== null)
    .map((t) => ({ task: t, day: localDateOf(t.completedAt!) }));

const tasksWord = (n: number) => `${n} ${n === 1 ? 'task' : 'tasks'}`;
const short = (date: LocalDate) =>
  new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
    parseLocalDate(date),
  );

/** Tasks finished per week, oldest first, ending with this week. */
export function completionsByWeek(
  tasks: Task[],
  today: LocalDate,
  weekStartsOn: WeekStart,
  weeks = 8,
): Bar[] {
  const thisWeek = startOfWeek(today, weekStartsOn);
  const starts = Array.from({ length: weeks }, (_, i) =>
    addLocalDays(thisWeek, -7 * (weeks - 1 - i)),
  );
  const counts = new Map(starts.map((s) => [s, 0]));
  for (const { day } of doneDays(tasks)) {
    const s = startOfWeek(day, weekStartsOn);
    if (counts.has(s)) counts.set(s, counts.get(s)! + 1);
  }
  return starts.map((s) => {
    const value = counts.get(s)!;
    const current = s === thisWeek;
    return {
      key: s,
      label: current ? 'This week' : short(s),
      value,
      current,
      description: `${current ? 'This week' : `Week of ${short(s)}`}: ${tasksWord(value)}`,
    };
  });
}

/** Tasks finished on each weekday over the last `weeks` weeks, in the user's week order. */
export function completionsByWeekday(
  tasks: Task[],
  today: LocalDate,
  weekStartsOn: WeekStart,
  weeks = 12,
): Bar[] {
  const from = addLocalDays(startOfWeek(today, weekStartsOn), -7 * (weeks - 1));
  const counts = new Array<number>(7).fill(0);
  for (const { day } of doneDays(tasks)) {
    if (day >= from && day <= today) counts[parseLocalDate(day).getDay()]!++;
  }
  // 2026-11-01 is a Sunday (getDay 0).
  return Array.from({ length: 7 }, (_, i) => {
    const dow = (weekStartsOn + i) % 7;
    const date = addLocalDays('2026-11-01', dow);
    const name = new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(
      parseLocalDate(date),
    );
    return {
      key: String(dow),
      label: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(parseLocalDate(date)),
      value: counts[dow]!,
      description: `${name}s: ${tasksWord(counts[dow]!)}`,
    };
  });
}

/** Tasks finished per category in the last `days` days, largest first. */
export function completionsByCategory(
  tasks: Task[],
  categories: Category[],
  today: LocalDate,
  days = 30,
): Bar[] {
  const from = addLocalDays(today, -(days - 1));
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const counts = new Map<string, number>();
  for (const { task, day } of doneDays(tasks)) {
    if (day < from || day > today) continue;
    const key = task.categoryId && names.has(task.categoryId) ? task.categoryId : '';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts]
    .map(([key, value]) => {
      const label = key ? names.get(key)! : 'No category';
      return { key: key || 'none', label, value, description: `${label}: ${tasksWord(value)}` };
    })
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

/** Totals for the summary cards. */
export function periodTotals(tasks: Task[], from: LocalDate, to: LocalDate) {
  return doneDays(tasks).filter(({ day }) => day >= from && day <= to).length;
}
