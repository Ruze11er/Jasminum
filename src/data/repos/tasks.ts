import { clock } from '@/lib/clock';
import { isLocalDate, localDateOf } from '@/lib/dates';
import { uuidv7 } from '@/lib/ids';
import { nextOccurrence, parseRecurrence } from '@/lib/recurrence';
import { z } from '@/lib/validation';
import { logActivity } from '../activity';
import { db } from '../db';
import { createRepository, EntityNotFoundError } from '../repository';
import { searchIndex, searchKey } from '../search/searchIndex';
import type { ChecklistItem, LocalDate, Task } from '../types';

const localDate = z.string().check(z.refine(isLocalDate, 'Pick a valid date'));
const time = z.string().check(z.regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Pick a valid time'));
const nullable = <T extends z.ZodMiniType>(s: T) => z._default(z.nullable(s), null);

export const taskSchema = z
  .object({
    title: z
      .string()
      .check(
        z.trim(),
        z.minLength(1, 'Give your task a title'),
        z.maxLength(200, 'Keep the title under 200 characters'),
      ),
    description: z._default(
      z.string().check(z.maxLength(5000, 'Keep notes under 5,000 characters')),
      '',
    ),
    status: z._default(z.enum(['todo', 'done']), 'todo'),
    priority: z._default(z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]), 0),
    dueDate: nullable(localDate),
    dueTime: nullable(time),
    scheduledDate: nullable(localDate),
    completedAt: nullable(z.number()),
    categoryId: nullable(z.string()),
    tagIds: z._default(z.array(z.string()), []),
    rrule: nullable(
      z.string().check(z.refine((s) => parseRecurrence(s) !== null, 'Invalid repeat rule')),
    ),
    seriesId: nullable(z.string()),
    postponeCount: z._default(z.int().check(z.minimum(0)), 0),
    originalDueDate: nullable(localDate),
    reminderAt: nullable(z.number()),
    order: z._default(z.number(), 0),
  })
  .check(
    z.refine((t) => !t.dueTime || !!t.dueDate, {
      message: 'Pick a date to go with the time',
      path: ['dueTime'],
    }),
    z.refine((t) => !t.rrule || !!t.dueDate, {
      message: 'Repeating tasks need a date',
      path: ['rrule'],
    }),
  );

export type TaskInput = z.input<typeof taskSchema>;
type TaskFields = z.output<typeof taskSchema>;

const base = createRepository<Task, TaskFields, TaskInput>({
  entityType: 'task',
  table: () => db.tasks,
  schema: taskSchema,
  toSearch: (t) => ({ title: t.title, body: t.description }),
  cascadeTables: () => [db.checklistItems],
  cascadePurge: async (t) => {
    await db.checklistItems.where('taskId').equals(t.id).delete();
  },
});

export interface ChecklistDraft {
  id?: string;
  text: string;
  done: boolean;
}

const today = () => localDateOf(clock.now());

/**
 * Where the next copy of a repeating task lands: the first occurrence after both its due
 * date and today. Finishing a daily task that is five days late gives one task for
 * tomorrow, not five overdue copies.
 */
export function nextDueDate(task: Pick<Task, 'rrule' | 'dueDate'>, todayDate: LocalDate) {
  const rule = task.rrule ? parseRecurrence(task.rrule) : null;
  if (!rule || !task.dueDate) return null;
  return nextOccurrence(rule, task.dueDate > todayDate ? task.dueDate : todayDate);
}

export const tasksRepo = {
  ...base,

  async create(input: TaskInput): Promise<Task> {
    return base.create({ order: clock.now(), ...input });
  },

  /** Same as the base update, but pushing the due date later counts as postponing. */
  async update(id: string, patch: Partial<TaskInput>): Promise<Task> {
    const before = await db.tasks.get(id);
    if (!before) throw new EntityNotFoundError('task', id);
    const postponed =
      before.status === 'todo' &&
      !!before.dueDate &&
      !!patch.dueDate &&
      patch.dueDate > before.dueDate;
    const updated = await base.update(id, {
      ...patch,
      ...(postponed && {
        postponeCount: before.postponeCount + 1,
        originalDueDate: before.originalDueDate ?? before.dueDate,
      }),
    });
    if (postponed) {
      await db.transaction('rw', db.activity, () =>
        logActivity('task.postponed', 'task', id, { from: before.dueDate, to: patch.dueDate }),
      );
    }
    return updated;
  },

  /** "Do it another day". */
  postpone: (id: string, to: LocalDate) => tasksRepo.update(id, { dueDate: to }),

  /**
   * Marks a task done. For repeating tasks, also creates the next copy, with its checklist
   * unticked. Safe to call twice: an existing next copy is reused, not duplicated.
   */
  async complete(id: string): Promise<{ task: Task; next: Task | null }> {
    let result!: { task: Task; next: Task | null };
    await db.transaction('rw', [db.tasks, db.checklistItems, db.activity], async () => {
      const task = await db.tasks.get(id);
      if (!task) throw new EntityNotFoundError('task', id);
      const now = clock.now();
      const done: Task = { ...task, status: 'done', completedAt: now, updatedAt: now };
      if (task.status !== 'done') {
        await db.tasks.put(done);
        await logActivity('task.completed', 'task', id);
      }

      let next: Task | null = null;
      const nextDate = nextDueDate(task, today());
      if (nextDate) {
        const seriesId = task.seriesId ?? task.id;
        const existing = await db.tasks
          .where('seriesId')
          .equals(seriesId)
          .filter((t) => t.status === 'todo' && !t.deletedAt && t.dueDate === nextDate)
          .first();
        if (existing) {
          next = existing;
        } else {
          next = {
            ...task,
            id: uuidv7(now),
            status: 'todo',
            dueDate: nextDate,
            completedAt: null,
            seriesId,
            postponeCount: 0,
            originalDueDate: null,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
            order: now,
          };
          await db.tasks.add(next);
          if (task.seriesId !== seriesId) await db.tasks.update(id, { seriesId });
          const items = await db.checklistItems.where('taskId').equals(id).toArray();
          await db.checklistItems.bulkAdd(
            items.map((it) => ({
              ...it,
              id: uuidv7(now),
              taskId: next!.id,
              done: 0 as const,
              createdAt: now,
              updatedAt: now,
            })),
          );
          await logActivity('task.created', 'task', next.id, { recurrenceOf: id });
        }
      }
      result = { task: done, next };
    });
    // This write bypassed the repository, so index the new copy for search here.
    const next = result.next;
    if (next) {
      searchIndex.upsert({
        key: searchKey('task', next.id),
        type: 'task',
        id: next.id,
        title: next.title,
        body: next.description,
      });
    }
    return result;
  },

  /** Reopens a finished task. */
  async reopen(id: string): Promise<Task> {
    return db.transaction('rw', [db.tasks, db.activity], async () => {
      const task = await db.tasks.get(id);
      if (!task) throw new EntityNotFoundError('task', id);
      const reopened: Task = { ...task, status: 'todo', completedAt: null, updatedAt: clock.now() };
      await db.tasks.put(reopened);
      await logActivity('task.updated', 'task', id, { reopened: true });
      return reopened;
    });
  },

  // ---------- checklist ----------

  checklist: (taskId: string) => db.checklistItems.where('taskId').equals(taskId).sortBy('order'),

  /**
   * Replaces a task's checklist with the edited list from the task form:
   * keeps items by id, adds new ones, removes the rest, and saves the order.
   */
  async saveChecklist(taskId: string, items: ChecklistDraft[]): Promise<void> {
    await db.transaction('rw', [db.tasks, db.checklistItems], async () => {
      if (!(await db.tasks.get(taskId))) throw new EntityNotFoundError('task', taskId);
      const now = clock.now();
      const existing = await db.checklistItems.where('taskId').equals(taskId).toArray();
      const keep = new Set(items.map((i) => i.id).filter(Boolean));
      await db.checklistItems.bulkDelete(existing.filter((e) => !keep.has(e.id)).map((e) => e.id));
      const byId = new Map(existing.map((e) => [e.id, e]));
      const rows: ChecklistItem[] = items
        .map((i) => ({ ...i, text: i.text.trim().slice(0, 300) }))
        .filter((i) => i.text)
        .map((i, order) => {
          const prev = i.id ? byId.get(i.id) : undefined;
          return {
            id: prev?.id ?? uuidv7(now),
            taskId,
            text: i.text,
            done: i.done ? 1 : 0,
            order,
            createdAt: prev?.createdAt ?? now,
            updatedAt: now,
            deletedAt: null,
          };
        });
      await db.checklistItems.bulkPut(rows);
      await db.tasks.update(taskId, { updatedAt: now });
    });
  },

  /** Ticks or unticks one checklist item straight from the task list. */
  async toggleChecklistItem(itemId: string): Promise<void> {
    await db.transaction('rw', [db.tasks, db.checklistItems], async () => {
      const item = await db.checklistItems.get(itemId);
      if (!item) return;
      const now = clock.now();
      await db.checklistItems.update(itemId, { done: item.done ? 0 : 1, updatedAt: now });
      await db.tasks.update(item.taskId, { updatedAt: now });
    });
  },
};
