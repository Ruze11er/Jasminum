import type { LocalDate, Priority, Task } from '@/data/types';
import { addLocalDays, dayLabel, localDateOf } from '@/lib/dates';

export type TaskView = 'today' | 'upcoming' | 'overdue' | 'all' | 'completed';

export interface TaskFilters {
  categoryId: string | null;
  tagId: string | null;
  /** Show tasks with at least this priority. 0 = any. */
  minPriority: Priority;
}

export const noFilters: TaskFilters = { categoryId: null, tagId: null, minPriority: 0 };

export type GroupTone = 'danger' | 'primary' | 'muted' | 'default';

export interface TaskGroup {
  key: string;
  title: string;
  tone: GroupTone;
  tasks: Task[];
}

export const isFiltering = (f: TaskFilters) => !!f.categoryId || !!f.tagId || f.minPriority > 0;

export function applyFilters(tasks: Task[], f: TaskFilters): Task[] {
  return tasks.filter(
    (t) =>
      (!f.categoryId || t.categoryId === f.categoryId) &&
      (!f.tagId || t.tagIds.includes(f.tagId)) &&
      t.priority >= f.minPriority,
  );
}

/** Within a day: highest priority first, then timed tasks by time, then the order added. */
export function compareTasks(a: Task, b: Task): number {
  return (
    b.priority - a.priority ||
    compareNullableLast(a.dueTime, b.dueTime) ||
    a.order - b.order ||
    a.createdAt - b.createdAt
  );
}

/** Earliest date first, then the same rules as compareTasks. */
export const compareByDate = (a: Task, b: Task) =>
  compareNullableLast(a.dueDate, b.dueDate) || compareTasks(a, b);

function compareNullableLast(a: string | null, b: string | null) {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

const isOpen = (t: Task) => t.status === 'todo' && !t.deletedAt;
const isDone = (t: Task) => t.status === 'done' && !t.deletedAt;

/** Groups for the chosen view. Empty groups are left out. */
export function buildView(
  view: TaskView,
  all: Task[],
  today: LocalDate,
  filters: TaskFilters = noFilters,
): TaskGroup[] {
  const tasks = applyFilters(all, filters);
  const open = tasks.filter(isOpen);
  const overdue = open.filter((t) => t.dueDate !== null && t.dueDate < today).sort(compareByDate);
  const dueToday = open.filter((t) => t.dueDate === today).sort(compareTasks);
  const future = open.filter((t) => t.dueDate !== null && t.dueDate > today).sort(compareByDate);
  const undated = open.filter((t) => t.dueDate === null).sort(compareTasks);

  const groups: TaskGroup[] = [];
  const add = (key: string, title: string, tone: GroupTone, list: Task[]) => {
    if (list.length) groups.push({ key, title, tone, tasks: list });
  };

  switch (view) {
    case 'today': {
      const doneToday = tasks
        .filter((t) => isDone(t) && t.completedAt !== null && localDateOf(t.completedAt) === today)
        .sort((a, b) => b.completedAt! - a.completedAt!);
      add('overdue', 'Overdue', 'danger', overdue);
      add('today', 'Today', 'primary', dueToday);
      add('done-today', 'Done today', 'muted', doneToday);
      break;
    }
    case 'upcoming':
      for (const [date, list] of groupBy(future, (t) => t.dueDate!)) {
        add(date, dayLabel(date, today), 'default', list);
      }
      break;
    case 'overdue':
      for (const [date, list] of groupBy(overdue, (t) => t.dueDate!)) {
        add(date, dayLabel(date, today), 'danger', list);
      }
      break;
    case 'all':
      add('overdue', 'Overdue', 'danger', overdue);
      add('today', 'Today', 'primary', dueToday);
      add('upcoming', 'Upcoming', 'default', future);
      add('undated', 'No date', 'default', undated);
      break;
    case 'completed': {
      const done = tasks.filter(isDone).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
      for (const [date, list] of groupBy(done, (t) => localDateOf(t.completedAt ?? t.updatedAt))) {
        add(`done-${date}`, dayLabel(date, today), 'muted', list);
      }
      break;
    }
  }
  return groups;
}

/** Badge counts for the view tabs (open tasks only). */
export function viewCounts(all: Task[], today: LocalDate, filters: TaskFilters = noFilters) {
  const open = applyFilters(all, filters).filter(isOpen);
  const overdue = open.filter((t) => t.dueDate !== null && t.dueDate < today).length;
  return {
    today: overdue + open.filter((t) => t.dueDate === today).length,
    upcoming: open.filter((t) => t.dueDate !== null && t.dueDate > today).length,
    overdue,
    all: open.length,
  };
}

/** Date a new task gets when quick-added from each view. */
export function defaultDueDate(view: TaskView, today: LocalDate): LocalDate | null {
  if (view === 'today' || view === 'overdue') return today;
  if (view === 'upcoming') return addLocalDays(today, 1);
  return null;
}

/** Today's progress for the dashboard ring: done today vs. done today + still due today/overdue. */
export function todayProgress(all: Task[], today: LocalDate) {
  const done = all.filter(
    (t) => isDone(t) && t.completedAt !== null && localDateOf(t.completedAt) === today,
  ).length;
  const remaining = all.filter((t) => isOpen(t) && t.dueDate !== null && t.dueDate <= today).length;
  return { done, total: done + remaining };
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}
