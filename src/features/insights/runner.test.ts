import { describe, expect, it } from 'vitest';
import { aggregateDailyStats } from '@/data/dailyStats';
import { db } from '@/data/db';
import { insightsRepo, SNOOZE_DAYS } from '@/data/repos/insights';
import { setSetting } from '@/data/repos/settings';
import { tasksRepo } from '@/data/repos/tasks';
import type { ActivityEntry, Task } from '@/data/types';
import { clock, DAY_MS } from '@/lib/clock';
import { spreadDay } from './actions';
import { runInsightsNow } from './runner';

const at = (date: string, time = '10:00') => new Date(`${date}T${time}:00`).getTime();
const NOW = at('2026-11-04');

describe('daily stats', () => {
  it('counts per local day from tasks and the activity log', () => {
    const task = (extra: Partial<Task>) =>
      ({ status: 'todo', completedAt: null, dueDate: null, deletedAt: null, ...extra }) as Task;
    const act = (type: ActivityEntry['type'], date: string): ActivityEntry => ({
      id: Math.random().toString(),
      at: at(date),
      type,
      entityType: 'task',
      entityId: null,
    });
    const rows = aggregateDailyStats({
      from: '2026-11-02',
      to: '2026-11-04',
      today: '2026-11-04',
      tasks: [
        task({ status: 'done', completedAt: at('2026-11-03'), dueDate: '2026-11-02' }), // done late
        task({ status: 'done', completedAt: at('2026-11-03'), dueDate: '2026-11-03' }), // on time
        task({ dueDate: '2026-11-03' }), // never done
        task({ dueDate: '2026-11-04' }),
        task({ status: 'done', completedAt: at('2026-11-02'), deletedAt: 1 }),
      ],
      activity: [
        act('task.created', '2026-11-02'),
        act('task.postponed', '2026-11-03'),
        act('note.updated', '2026-11-04'),
        act('note.created', '2026-11-04'),
        act('document.created', '2026-11-04'),
        act('document.opened', '2026-11-04'),
        act('task.created', '2026-10-01'), // outside the range
      ],
    });
    expect(rows.map((r) => r.date)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04']);
    expect(rows[0]).toMatchObject({
      tasksCreated: 1,
      tasksDue: 1,
      tasksOverdue: 1,
      tasksCompleted: 0,
    });
    expect(rows[1]).toMatchObject({
      tasksCompleted: 2,
      tasksDue: 2,
      tasksOverdue: 1,
      tasksPostponed: 1,
    });
    expect(rows[2]).toMatchObject({
      tasksDue: 1,
      tasksOverdue: 0,
      notesEdited: 2,
      docsAdded: 1,
      docsOpened: 1,
    });
  });
});

describe('insight runner', () => {
  it('stores nothing for a new user', async () => {
    expect(await runInsightsNow(NOW)).toEqual([]);
    expect(await db.insights.count()).toBe(0);
    expect(await db.dailyStats.count()).toBe(90);
  });

  it('stores insights, keeps dismissals and removes resolved ones', async () => {
    clock.set(NOW - 3 * DAY_MS);
    const late = await tasksRepo.create({ title: 'Pay rent', dueDate: '2026-11-01' });
    clock.set(NOW);
    await runInsightsNow(NOW);
    let [insight] = await insightsRepo.active();
    expect(insight).toMatchObject({ ruleId: 'R1', fingerprint: 'R1:2026-11-04', status: 'active' });
    expect(insight!.payload).toMatchObject({ title: '“Pay rent” is overdue', tone: 'action' });

    // Dismissed: stays hidden on later runs the same day…
    await insightsRepo.dismiss(insight!.id);
    await runInsightsNow(NOW + 60_000);
    expect(await insightsRepo.active()).toEqual([]);
    // …but tomorrow is a new day with a new fingerprint.
    await runInsightsNow(NOW + DAY_MS);
    [insight] = await insightsRepo.active();
    expect(insight?.fingerprint).toBe('R1:2026-11-05');

    // Done with the task: the insight goes away by itself.
    await tasksRepo.complete(late.id);
    await runInsightsNow(NOW + DAY_MS + 60_000);
    expect(await insightsRepo.active()).toEqual([]);
  });

  it('snoozes for a week, then shows it again if still true', async () => {
    const t = await tasksRepo.create({ title: 'Read ch. 4', postponeCount: 3 });
    await runInsightsNow(NOW);
    const [insight] = await insightsRepo.active();
    expect(insight?.fingerprint).toBe(`R2:${t.id}:3`);
    await insightsRepo.snooze(insight!.id, NOW);
    await runInsightsNow(NOW + DAY_MS);
    expect(await insightsRepo.active()).toEqual([]);
    await runInsightsNow(NOW + (SNOOZE_DAYS + 1) * DAY_MS);
    expect((await insightsRepo.active()).map((i) => i.id)).toEqual([insight!.id]);
  });

  it('respects rules that were switched off', async () => {
    await tasksRepo.create({ title: 'Late', dueDate: '2026-11-01' });
    await setSetting('insightPrefs', { disabledRules: ['R1'] });
    await runInsightsNow(NOW);
    expect(await insightsRepo.active()).toEqual([]);
  });
});

describe('spreading a packed day', () => {
  it('moves low-priority untimed tasks to the next days without counting a postpone', async () => {
    clock.set(NOW);
    const day = '2026-11-06';
    for (let i = 0; i < 9; i++) await tasksRepo.create({ title: `Low ${i}`, dueDate: day });
    await tasksRepo.create({ title: 'Important', dueDate: day, priority: 3 });
    await tasksRepo.create({ title: 'Timed', dueDate: day, dueTime: '09:00' });

    expect(await spreadDay(day)).toBe(3); // 11 tasks → 8
    const left = await db.tasks.where('dueDate').equals(day).toArray();
    expect(left).toHaveLength(8);
    expect(left.map((t) => t.title)).toEqual(expect.arrayContaining(['Important', 'Timed']));
    const moved = await db.tasks
      .where('dueDate')
      .anyOf('2026-11-07', '2026-11-08', '2026-11-09')
      .toArray();
    expect(moved.map((t) => t.dueDate).sort()).toEqual(['2026-11-07', '2026-11-08', '2026-11-09']);
    expect(moved.every((t) => t.postponeCount === 0)).toBe(true);
  });
});
