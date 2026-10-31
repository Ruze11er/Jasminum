import { clock, DAY_MS } from '@/lib/clock';
import { addLocalDays, localDateOf } from '@/lib/dates';
import { db } from './db';
import type { ActivityEntry, DailyStats, LocalDate, Task } from './types';

/**
 * One row of numbers per local day, for insights and charts. Rebuilt from the source
 * of truth each time (idempotent), so it can never drift:
 * - completions come from the tasks themselves (a reopened task no longer counts),
 * - created, postponed, notes and files come from the activity log.
 */

const empty = (date: LocalDate): DailyStats => ({
  date,
  tasksCreated: 0,
  tasksCompleted: 0,
  tasksDue: 0,
  tasksOverdue: 0,
  tasksPostponed: 0,
  notesEdited: 0,
  docsAdded: 0,
  docsOpened: 0,
});

/** Pure: stats for every day from `from` to `to` (inclusive). */
export function aggregateDailyStats(input: {
  tasks: Task[];
  activity: ActivityEntry[];
  from: LocalDate;
  to: LocalDate;
  today: LocalDate;
}): DailyStats[] {
  const { from, to, today } = input;
  const rows = new Map<LocalDate, DailyStats>();
  for (let d = from; d <= to; d = addLocalDays(d, 1)) rows.set(d, empty(d));
  const row = (date: LocalDate) => rows.get(date);

  for (const t of input.tasks) {
    if (t.deletedAt) continue;
    const doneDay =
      t.status === 'done' && t.completedAt !== null ? localDateOf(t.completedAt) : null;
    if (doneDay) {
      const r = row(doneDay);
      if (r) r.tasksCompleted++;
    }
    if (t.dueDate) {
      const r = row(t.dueDate);
      if (r) {
        r.tasksDue++;
        // Overdue on a past day = not finished by the end of it.
        if (t.dueDate < today && (!doneDay || doneDay > t.dueDate)) r.tasksOverdue++;
      }
    }
  }

  for (const a of input.activity) {
    const r = row(localDateOf(a.at));
    if (!r) continue;
    if (a.type === 'task.created') r.tasksCreated++;
    else if (a.type === 'task.postponed') r.tasksPostponed++;
    else if (a.type === 'note.created' || a.type === 'note.updated') r.notesEdited++;
    else if (a.type === 'document.created') r.docsAdded++;
    else if (a.type === 'document.opened') r.docsOpened++;
  }
  return [...rows.values()];
}

/** Recomputes the last `days` days and saves them. Returns the rows, oldest first. */
export async function refreshDailyStats(now = clock.now(), days = 90): Promise<DailyStats[]> {
  const today = localDateOf(now);
  const from = addLocalDays(today, -(days - 1));
  const since = now - (days + 1) * DAY_MS;
  const [tasks, activity] = await Promise.all([
    db.tasks.toArray(),
    db.activity.where('at').above(since).toArray(),
  ]);
  const rows = aggregateDailyStats({ tasks, activity, from, to: today, today });
  await db.dailyStats.bulkPut(rows);
  return rows;
}
