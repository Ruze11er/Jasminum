import type { ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, Flame, Library, NotebookPen } from 'lucide-react';
import { db } from '@/data/db';
import { useSetting } from '@/data/repos/settings';
import type { LocalDate } from '@/data/types';
import { CardLink, LinkCard } from '@/design-system';
import { formatBytes } from '@/lib/format';
import { compareWeeks, miniStats } from './stats';

/** A number on Home; the whole tile opens the page it's about. */
function Tile({
  icon,
  label,
  value,
  hint,
  to,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint: string;
  to: string;
}) {
  return (
    <LinkCard className="p-4 md:p-4">
      <dt className="flex items-center gap-1.5 text-sm font-semibold text-fg-muted [&>svg]:size-4">
        {icon}
        <CardLink to={to}>{label}</CardLink>
      </dt>
      <dd className="mt-1 font-display text-2xl font-bold">{value}</dd>
      <dd className="text-xs text-fg-muted">{hint}</dd>
    </LinkCard>
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
          to="/tasks"
          value={stats.doneThisWeek}
          hint={compareWeeks(stats.doneThisWeek, stats.doneLastWeek)}
        />
        <Tile
          icon={<Flame aria-hidden="true" />}
          label="Streak"
          to="/insights"
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
          to="/notes"
          value={stats.notesThisWeek}
          hint="Written or edited"
        />
        <Tile
          icon={<Library aria-hidden="true" />}
          label="Library"
          to="/library"
          value={stats.files}
          hint={stats.files ? formatBytes(stats.fileBytes) : 'No files yet'}
        />
      </dl>
    </section>
  );
}
