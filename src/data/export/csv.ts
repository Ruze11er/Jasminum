import { describeRecurrence, parseRecurrence } from '@/lib/recurrence';
import { db } from '../db';
import type { Category, Tag, Task } from '../types';

/**
 * CSV for spreadsheets. Values starting with = + - @ (or a tab/return) get a leading
 * apostrophe so a spreadsheet never runs them as formulas ("CSV injection").
 */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const csvRow = (values: unknown[]) => values.map(csvCell).join(',');

const PRIORITY = ['', 'Low', 'Medium', 'High'];
const BOM = String.fromCharCode(0xfeff);
const isoDate = (ms: number | null) => (ms ? new Date(ms).toISOString() : '');

export function tasksToCsv(
  tasks: Task[],
  categoryById: Map<string, Pick<Category, 'name'>>,
  tagById: Map<string, Pick<Tag, 'name'>>,
): string {
  const header = [
    'Title',
    'Status',
    'Priority',
    'Due date',
    'Due time',
    'Category',
    'Tags',
    'Repeats',
    'Notes',
    'Created',
    'Completed',
  ];
  const rows = tasks.map((t) => {
    const rule = t.rrule ? parseRecurrence(t.rrule) : null;
    return csvRow([
      t.title,
      t.status === 'done' ? 'Done' : 'To do',
      PRIORITY[t.priority],
      t.dueDate ?? '',
      t.dueTime ?? '',
      t.categoryId ? (categoryById.get(t.categoryId)?.name ?? '') : '',
      t.tagIds
        .map((id) => tagById.get(id)?.name)
        .filter(Boolean)
        .join(', '),
      rule ? describeRecurrence(rule) : '',
      t.description,
      isoDate(t.createdAt),
      isoDate(t.completedAt),
    ]);
  });
  // The BOM tells Excel the file is UTF-8, so accents and emoji show correctly.
  return `${BOM}${[csvRow(header), ...rows].join('\r\n')}\r\n`;
}

/** All tasks (not the Trash), by due date, as a CSV file. */
export async function exportTasksCsv(): Promise<{ blob: Blob; count: number }> {
  const [tasks, categories, tags] = await Promise.all([
    db.tasks.filter((t) => !t.deletedAt).toArray(),
    db.categories.toArray(),
    db.tags.toArray(),
  ]);
  tasks.sort(
    (a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.createdAt - b.createdAt,
  );
  const csv = tasksToCsv(
    tasks,
    new Map(categories.map((c) => [c.id, c])),
    new Map(tags.map((t) => [t.id, t])),
  );
  return { blob: new Blob([csv], { type: 'text/csv;charset=utf-8' }), count: tasks.length };
}
