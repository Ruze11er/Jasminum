import { toast } from '@/design-system';
import { db } from '@/data/db';
import { documentsRepo } from '@/data/repos/documents';
import { insightsRepo } from '@/data/repos/insights';
import { tasksRepo } from '@/data/repos/tasks';
import type { Insight, LocalDate, Task } from '@/data/types';
import { clock } from '@/lib/clock';
import { addLocalDays, localDateOf } from '@/lib/dates';
import { deleteTask, moveTasks } from '@/features/tasks/taskActions';
import { useTaskEditor } from '@/features/tasks/editorStore';
import type { InsightAction } from './engine/types';

type Navigate = (to: string) => void;

/**
 * Moves the low-priority, untimed tasks of a packed day onto the next three days, one
 * at a time, until the day is down to `keep` tasks. Not counted as postponing: the app
 * moved them, not the user.
 */
export async function spreadDay(date: LocalDate, keep = 8): Promise<number> {
  const due = await db.tasks
    .where('dueDate')
    .equals(date)
    .filter((t) => t.status === 'todo' && !t.deletedAt)
    .toArray();
  const movable = due
    .filter((t) => t.priority <= 1 && !t.dueTime)
    .sort((a, b) => a.priority - b.priority || b.order - a.order);
  const toMove = movable.slice(0, Math.max(0, due.length - keep));
  for (const [i, t] of toMove.entries()) {
    await tasksRepo.update(
      t.id,
      { dueDate: addLocalDays(date, 1 + (i % 3)) },
      { countAsPostpone: false },
    );
  }
  return toMove.length;
}

/**
 * Does what an insight's button says. Actions that resolve the insight mark it as acted
 * on; ones that just open something leave it in place until the situation changes.
 */
export async function runInsightAction(
  insight: Insight,
  action: InsightAction,
  navigate: Navigate,
) {
  const done = () => insightsRepo.markActed(insight.id);
  switch (action.type) {
    case 'move-overdue-today': {
      const today = localDateOf(clock.now());
      const late = await db.tasks
        .filter((t) => t.status === 'todo' && !t.deletedAt && !!t.dueDate && t.dueDate < today)
        .toArray();
      await moveTasks(late, today);
      await done();
      return;
    }
    case 'open-tasks':
      navigate(`/tasks?view=${action.view}`);
      return;
    case 'open-task':
      useTaskEditor.getState().openEdit(action.taskId);
      return;
    case 'lower-priority': {
      const t = await db.tasks.get(action.taskId);
      if (!t) return;
      await tasksRepo.update(t.id, { priority: Math.max(0, t.priority - 1) as Task['priority'] });
      toast({ message: 'Priority lowered' });
      await done();
      return;
    }
    case 'delete-task': {
      const t = await db.tasks.get(action.taskId);
      if (t) await deleteTask(t);
      await done();
      return;
    }
    case 'spread-day': {
      const moved = await spreadDay(action.date);
      toast({
        message: moved
          ? `${moved} low-priority ${moved === 1 ? 'task' : 'tasks'} moved to the next days`
          : 'Nothing could be moved: the tasks there are important or have a time',
      });
      if (moved) await done();
      return;
    }
    case 'open-calendar-day':
      navigate(`/calendar?view=day&date=${action.date}`);
      return;
    case 'favorite-document': {
      const d = await db.documents.get(action.documentId);
      if (d && !d.favorite) await documentsRepo.toggleFavorite(d);
      toast({ message: 'Added to favorites' });
      await done();
      return;
    }
    case 'open-document':
      navigate(`/library/${action.documentId}`);
      return;
    case 'open-library':
      navigate(action.view === 'untagged' ? '/library?in=untagged' : '/library');
      return;
    case 'backup':
      navigate('/settings?backup=1');
      return;
    case 'manage-storage':
      navigate('/library?sort=size');
      return;
  }
}
