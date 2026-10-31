import type { ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, Flame, Library, NotebookPen } from 'lucide-react';
import { db } from '@/data/db';
import { useSetting } from '@/data/repos/settings';
import type { LocalDate } from '@/data/types';
import { formatBytes } from '@/lib/format';
import { compareWeeks, miniStats } from './stats';

function Tile({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-soft-sm">
      <dt className="flex items-center gap-1.5 text-sm font-semibold text-fg-muted [&>svg]:size-4">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 font-display text-2xl font-bold">{value}</dd>
      <dd className="text-xs text-fg-muted">{hint}</dd>
    </div>
  );
}

/** Small numbers about your week: tasks done, streak, notes, library. */
export function StatsRow({ today }: { today: LocalDate }) {
  const weekStartsOn = useSetting('weekStartsOn');
  const stats = useLiveQuery(async () => {
    const [tasks, notes, docs] = await Promise.all([
      db.tasks.where('status').equals('done').toArray(),
      db.notes.toArray(),
      db.documents.toArray(),
    ]);
    return miniStats({ tasks, notes, docs, today, weekStartsOn });
  }, [today, weekStartsOn]);

  if (!stats) return <div aria-busy="true" className="h-28" />;
  return (
    <section aria-labelledby="stats-heading">
      <h2 id="stats-heading" className="sr-only">
        Your week
      </h2>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          icon={<CheckCircle2 aria-hidden="true" />}
          label="Done this week"
          value={stats.doneThisWeek}
          hint={compareWeeks(stats.doneThisWeek, stats.doneLastWeek)}
        />
        <Tile
          icon={<Flame aria-hidden="true" />}
          label="Streak"
          value={`${stats.streak} ${stats.streak === 1 ? 'day' : 'days'}`}
          hint={
            stats.streak === 0
              ? 'Finish a task to start one'
              : stats.streakIncludesToday
                ? 'Including today'
                : 'Finish a task today to keep it'
          }
        />
        <Tile
          icon={<NotebookPen aria-hidden="true" />}
          label="Notes this week"
          value={stats.notesThisWeek}
          hint="Written or edited"
        />
        <Tile
          icon={<Library aria-hidden="true" />}
          label="Library"
          value={stats.files}
          hint={stats.files ? formatBytes(stats.fileBytes) : 'No files yet'}
        />
      </dl>
    </section>
  );
}
