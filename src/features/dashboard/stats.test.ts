import { describe, expect, it } from 'vitest';
import type { LibraryDocument, Note, Task } from '@/data/types';
import { compareWeeks, miniStats } from './stats';

const at = (date: string, time = '12:00') => new Date(`${date}T${time}:00`).getTime();
const done = (date: string, extra: Partial<Task> = {}) =>
  ({ status: 'done', completedAt: at(date), deletedAt: null, ...extra }) as Task;
const note = (date: string, extra: Partial<Note> = {}) =>
  ({ updatedAt: at(date), deletedAt: null, ...extra }) as Note;
const doc = (size: number, extra: Partial<LibraryDocument> = {}) =>
  ({ size, deletedAt: null, ...extra }) as LibraryDocument;

// 2026-11-04 is a Wednesday; with Monday weeks this week started Nov 2.
const base = { today: '2026-11-04', weekStartsOn: 1 as const, notes: [], docs: [] };

describe('mini stats', () => {
  it('counts tasks done this week and last week', () => {
    const s = miniStats({
      ...base,
      tasks: [
        done('2026-11-02'),
        done('2026-11-04'),
        done('2026-11-01'), // Sunday: last week
        done('2026-10-26'), // last Monday
        done('2026-10-25'), // two weeks ago
        done('2026-11-04', { deletedAt: 1 }),
        { status: 'todo', completedAt: null, deletedAt: null } as Task,
      ],
    });
    expect(s).toMatchObject({ doneThisWeek: 2, doneLastWeek: 2 });
    // With Sunday weeks, Nov 1 belongs to this week.
    expect(miniStats({ ...base, weekStartsOn: 0, tasks: [done('2026-11-01')] }).doneThisWeek).toBe(
      1,
    );
  });

  it('counts the streak of days with something done', () => {
    const days = ['2026-11-01', '2026-11-02', '2026-11-03'];
    const yesterday = miniStats({ ...base, tasks: days.map((d) => done(d)) });
    expect(yesterday).toMatchObject({ streak: 3, streakIncludesToday: false });

    const today = miniStats({ ...base, tasks: [...days, '2026-11-04'].map((d) => done(d)) });
    expect(today).toMatchObject({ streak: 4, streakIncludesToday: true });

    const broken = miniStats({ ...base, tasks: [done('2026-11-01'), done('2026-11-03')] });
    expect(broken.streak).toBe(1);
    expect(miniStats({ ...base, tasks: [done('2026-10-30')] }).streak).toBe(0);
  });

  it('counts notes edited this week and files in the library', () => {
    const s = miniStats({
      ...base,
      tasks: [],
      notes: [note('2026-11-03'), note('2026-10-30'), note('2026-11-04', { deletedAt: 5 })],
      docs: [doc(1000), doc(500), doc(99, { deletedAt: 1 })],
    });
    expect(s).toMatchObject({ notesThisWeek: 1, files: 2, fileBytes: 1500 });
  });

  it('compares weeks in words', () => {
    expect(compareWeeks(5, 2)).toBe('3 more than last week');
    expect(compareWeeks(1, 4)).toBe('3 fewer than last week');
    expect(compareWeeks(3, 3)).toBe('Same as last week');
    expect(compareWeeks(0, 0)).toBe('A fresh start');
  });
});
