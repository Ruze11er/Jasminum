import { toast } from '@/design-system';
import { tasksRepo } from '@/data/repos/tasks';
import type { Task } from '@/data/types';
import { clock } from '@/lib/clock';
import { dayLabel, localDateOf } from '@/lib/dates';
import { firstIssue } from '@/lib/validation';

/** Shared task actions with friendly feedback, used by the list, Home and the editor. */

export async function toggleTaskDone(task: Task) {
  if (task.status === 'done') {
    await tasksRepo.reopen(task.id);
    return;
  }
  const { next } = await tasksRepo.complete(task.id);
  const today = localDateOf(clock.now());
  toast({
    message: next?.dueDate ? `Done! Next one: ${dayLabel(next.dueDate, today)}` : 'Task done',
    action: { label: 'Undo', onClick: () => void tasksRepo.reopen(task.id) },
  });
}

export async function deleteTask(task: Task) {
  await tasksRepo.softDelete(task.id);
  toast({
    message: 'Moved to Trash',
    action: { label: 'Undo', onClick: () => void tasksRepo.restore(task.id) },
  });
}

/** Moves tasks to a new date, e.g. "Move overdue to today". */
export async function moveTasks(tasks: Task[], to: string) {
  try {
    for (const t of tasks) await tasksRepo.update(t.id, { dueDate: to });
    toast({ message: tasks.length === 1 ? 'Task moved' : `${tasks.length} tasks moved` });
  } catch (err) {
    toast({ tone: 'error', message: firstIssue(err) ?? "Couldn't move tasks" });
  }
}
