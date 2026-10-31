import type { WeekStart } from '@/data/repos/settings';
import type { LibraryDocument, LocalDate, Note, Task } from '@/data/types';
import { addLocalDays, localDateOf } from '@/lib/dates';
import { startOfWeek } from '@/features/calendar/selectors';

export interface MiniStats {
  doneThisWeek: number;
  doneLastWeek: number;
  /** Days in a row with at least one task done, ending today (or yesterday if none yet today). */
  streak: number;
  /** Whether today already counts toward the streak. */
  streakIncludesToday: boolean;
  notesThisWeek: number;
  files: number;
  fileBytes: number;
}

/** The small numbers on Home. Pure: everything comes in, including today. */
export function miniStats(input: {
  tasks: Task[];
  notes: Note[];
  docs: LibraryDocument[];
  today: LocalDate;
  weekStartsOn: WeekStart;
}): MiniStats {
  const { today, weekStartsOn } = input;
  const weekStart = startOfWeek(today, weekStartsOn);
  const lastWeekStart = addLocalDays(weekStart, -7);

  const doneDays = new Set<LocalDate>();
  let doneThisWeek = 0;
  let doneLastWeek = 0;
  for (const t of input.tasks) {
    if (t.deletedAt || t.status !== 'done' || t.completedAt === null) continue;
    const day = localDateOf(t.completedAt);
    doneDays.add(day);
    if (day >= weekStart && day <= today) doneThisWeek++;
    else if (day >= lastWeekStart && day < weekStart) doneLastWeek++;
  }

  const streakIncludesToday = doneDays.has(today);
  let streak = 0;
  for (
    let day = streakIncludesToday ? today : addLocalDays(today, -1);
    doneDays.has(day);
    day = addLocalDays(day, -1)
  ) {
    streak++;
  }

  const notesThisWeek = input.notes.filter(
    (n) => !n.deletedAt && localDateOf(n.updatedAt) >= weekStart,
  ).length;
  const docs = input.docs.filter((d) => !d.deletedAt);

  return {
    doneThisWeek,
    doneLastWeek,
    streak,
    streakIncludesToday,
    notesThisWeek,
    files: docs.length,
    fileBytes: docs.reduce((sum, d) => sum + d.size, 0),
  };
}

/** "3 more than last week", "Same as last week", "2 fewer than last week". */
export function compareWeeks(thisWeek: number, lastWeek: number): string {
  const diff = thisWeek - lastWeek;
  if (diff === 0) return lastWeek === 0 ? 'A fresh start' : 'Same as last week';
  return diff > 0 ? `${diff} more than last week` : `${-diff} fewer than last week`;
}
