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

const tasksLabel = (n: number) => `${n} ${n === 1 ? 'task' : 'tasks'}`;

/** Marks tasks done (repeating ones get their next copy), with Undo. */
export async function completeTasks(tasks: Task[]) {
  const open = tasks.filter((t) => t.status !== 'done');
  for (const t of open) await tasksRepo.complete(t.id);
  toast({
    message: open.length === 1 ? 'Task done' : `${tasksLabel(open.length)} done`,
    action: {
      label: 'Undo',
      onClick: () => {
        for (const t of open) void tasksRepo.reopen(t.id);
      },
    },
  });
}

/** Marks done tasks as not done again. */
export async function reopenTasks(tasks: Task[]) {
  const done = tasks.filter((t) => t.status === 'done');
  for (const t of done) await tasksRepo.reopen(t.id);
  toast({ message: `${tasksLabel(done.length)} marked not done` });
}

/** Moves tasks to the Trash, with Undo. */
export async function deleteTasks(tasks: Task[]) {
  for (const t of tasks) await tasksRepo.softDelete(t.id);
  toast({
    message: tasks.length === 1 ? 'Moved to Trash' : `${tasksLabel(tasks.length)} moved to Trash`,
    action: {
      label: 'Undo',
      onClick: () => {
        for (const t of tasks) void tasksRepo.restore(t.id);
      },
    },
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
