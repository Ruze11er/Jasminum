import { describe, expect, it } from 'vitest';
import type { Task } from '@/data/types';
import { buildView, defaultDueDate, todayProgress, viewCounts } from './selectors';

const TODAY = '2026-10-30';
const at = (date: string, hh = 12) =>
  new Date(`${date}T${String(hh).padStart(2, '0')}:00:00`).getTime();

let seq = 0;
function task(p: Partial<Task> & { title: string }): Task {
  seq++;
  return {
    id: `t${seq}`,
    description: '',
    status: 'todo',
    priority: 0,
    dueDate: null,
    dueTime: null,
    scheduledDate: null,
    completedAt: null,
    categoryId: null,
    tagIds: [],
    rrule: null,
    seriesId: null,
    postponeCount: 0,
    originalDueDate: null,
    reminderAt: null,
    order: seq,
    createdAt: seq,
    updatedAt: seq,
    deletedAt: null,
    ...p,
  };
}

const tasks = [
  task({ title: 'late low', dueDate: '2026-10-28' }),
  task({ title: 'late high', dueDate: '2026-10-29', priority: 3 }),
  task({ title: 'today 9am', dueDate: TODAY, dueTime: '09:00' }),
  task({ title: 'today high', dueDate: TODAY, priority: 3 }),
  task({ title: 'today plain', dueDate: TODAY }),
  task({ title: 'today 8am', dueDate: TODAY, dueTime: '08:00' }),
  task({ title: 'tomorrow', dueDate: '2026-10-31', categoryId: 'school' }),
  task({ title: 'next week', dueDate: '2026-11-04', tagIds: ['exam'] }),
  task({ title: 'someday', priority: 1 }),
  task({ title: 'done today', status: 'done', dueDate: TODAY, completedAt: at(TODAY, 10) }),
  task({ title: 'done yesterday', status: 'done', completedAt: at('2026-10-29') }),
  task({ title: 'deleted', dueDate: TODAY, deletedAt: 5 }),
];

const titles = (view: Parameters<typeof buildView>[0], filters?: Parameters<typeof buildView>[3]) =>
  buildView(view, tasks, TODAY, filters).map((g) => [g.title, g.tasks.map((t) => t.title)]);

describe('task views', () => {
  it('Today: overdue, then today (priority, time, order), then done today', () => {
    expect(titles('today')).toEqual([
      ['Overdue', ['late low', 'late high']],
      ['Today', ['today high', 'today 8am', 'today 9am', 'today plain']],
      ['Done today', ['done today']],
    ]);
  });

  it('Upcoming: grouped by future date', () => {
    expect(titles('upcoming')).toEqual([
      ['Tomorrow', ['tomorrow']],
      [expect.stringMatching(/Wednesday/), ['next week']],
    ]);
  });

  it('Overdue: grouped by day', () => {
    expect(titles('overdue')).toEqual([
      [expect.stringMatching(/Oct 28/), ['late low']],
      ['Yesterday', ['late high']],
    ]);
  });

  it('All: every open task, including undated ones', () => {
    expect(titles('all').map(([title]) => title)).toEqual([
      'Overdue',
      'Today',
      'Upcoming',
      'No date',
    ]);
    expect(titles('all').at(-1)).toEqual(['No date', ['someday']]);
  });

  it('Completed: newest first, grouped by completion day', () => {
    expect(titles('completed')).toEqual([
      ['Today', ['done today']],
      ['Yesterday', ['done yesterday']],
    ]);
  });

  it('never shows deleted tasks', () => {
    for (const view of ['today', 'upcoming', 'overdue', 'all', 'completed'] as const) {
      expect(JSON.stringify(titles(view))).not.toContain('deleted');
    }
  });
});

describe('filters', () => {
  it('by category, tag and minimum priority', () => {
    expect(titles('all', { categoryId: 'school', tagId: null, minPriority: 0 })).toEqual([
      ['Upcoming', ['tomorrow']],
    ]);
    expect(titles('all', { categoryId: null, tagId: 'exam', minPriority: 0 })).toEqual([
      ['Upcoming', ['next week']],
    ]);
    expect(titles('all', { categoryId: null, tagId: null, minPriority: 3 })).toEqual([
      ['Overdue', ['late high']],
      ['Today', ['today high']],
    ]);
  });
});

describe('counts, defaults and progress', () => {
  it('counts open tasks per view', () => {
    expect(viewCounts(tasks, TODAY)).toEqual({ today: 6, upcoming: 2, overdue: 2, all: 9 });
  });

  it('picks a sensible date for quick-added tasks', () => {
    expect(defaultDueDate('today', TODAY)).toBe(TODAY);
    expect(defaultDueDate('upcoming', TODAY)).toBe('2026-10-31');
    expect(defaultDueDate('all', TODAY)).toBeNull();
  });

  it("measures today's progress", () => {
    expect(todayProgress(tasks, TODAY)).toEqual({ done: 1, total: 7 });
  });
});
