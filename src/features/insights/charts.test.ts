import { describe, expect, it } from 'vitest';
import type { Category, Task } from '@/data/types';
import {
  completionsByCategory,
  completionsByWeek,
  completionsByWeekday,
  periodTotals,
} from './charts';

const TODAY = '2026-11-04'; // Wednesday; Monday weeks start Nov 2
const done = (date: string, extra: Partial<Task> = {}) =>
  ({
    status: 'done',
    completedAt: new Date(`${date}T10:00:00`).getTime(),
    deletedAt: null,
    categoryId: null,
    ...extra,
  }) as Task;
const cat = (id: string, name: string) => ({ id, name }) as Category;

describe('chart data', () => {
  const tasks = [
    done('2026-11-02'),
    done('2026-11-04', { categoryId: 'c1' }),
    done('2026-10-27', { categoryId: 'c1' }),
    done('2026-10-26', { categoryId: 'c2' }),
    done('2026-09-01'), // older than 8 weeks
    done('2026-11-03', { deletedAt: 1 }),
    { status: 'todo', completedAt: null, deletedAt: null } as Task,
  ];

  it('counts tasks per week, ending with this week', () => {
    const bars = completionsByWeek(tasks, TODAY, 1);
    expect(bars).toHaveLength(8);
    expect(bars.at(-1)).toMatchObject({
      key: '2026-11-02',
      label: 'This week',
      value: 2,
      current: true,
      description: 'This week: 2 tasks',
    });
    expect(bars.at(-2)).toMatchObject({ key: '2026-10-26', value: 2 });
    expect(bars[0]!.key).toBe('2026-09-14');
    expect(bars.reduce((n, b) => n + b.value, 0)).toBe(4);
  });

  it('counts by weekday in the chosen week order', () => {
    const monday = completionsByWeekday(tasks, TODAY, 1);
    expect(monday.map((b) => b.key)).toEqual(['1', '2', '3', '4', '5', '6', '0']);
    expect(monday[0]).toMatchObject({ value: 2 }); // Mondays: Nov 2, Oct 26
    expect(monday[0]!.description).toMatch(/Mondays: 2 tasks/);
    expect(completionsByWeekday(tasks, TODAY, 0)[0]!.key).toBe('0');
  });

  it('counts by category, largest first, with "No category"', () => {
    const bars = completionsByCategory(tasks, [cat('c1', 'School'), cat('c2', 'Home')], TODAY);
    expect(bars.map((b) => [b.label, b.value])).toEqual([
      ['School', 2],
      ['Home', 1],
      ['No category', 1],
    ]);
  });

  it('totals a period', () => {
    expect(periodTotals(tasks, '2026-11-02', TODAY)).toBe(2);
    expect(periodTotals(tasks, '2026-10-01', '2026-10-31')).toBe(2);
  });
});
