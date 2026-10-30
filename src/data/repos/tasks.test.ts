import { describe, expect, it } from 'vitest';
import { clock } from '@/lib/clock';
import { formatRecurrence } from '@/lib/recurrence';
import { ValidationError } from '@/lib/validation';
import { db } from '../db';
import { searchIndex } from '../search/searchIndex';
import { listTrash } from '../trash';
import { nextDueDate, tasksRepo } from './tasks';

/** Noon local time on a date, so "today" is unambiguous. */
const at = (date: string) => new Date(`${date}T12:00:00`).getTime();
const daily = (start: string) =>
  formatRecurrence({ start, freq: 'DAILY', interval: 1, byDay: [], until: null });

describe('task validation', () => {
  it('fills defaults', async () => {
    clock.set(at('2026-10-30'));
    const t = await tasksRepo.create({ title: '  Read chapter 4 ' });
    expect(t).toMatchObject({
      title: 'Read chapter 4',
      description: '',
      status: 'todo',
      priority: 0,
      dueDate: null,
      tagIds: [],
      postponeCount: 0,
      order: at('2026-10-30'),
    });
  });

  it.each([
    [{ title: '' }, 'Give your task a title'],
    [{ title: 'x', dueDate: '2026-02-30' }, 'Pick a valid date'],
    [{ title: 'x', dueDate: '2026-10-30', dueTime: '25:00' }, 'Pick a valid time'],
    [{ title: 'x', dueTime: '09:00' }, 'Pick a date to go with the time'],
    [{ title: 'x', rrule: daily('2026-10-30') }, 'Repeating tasks need a date'],
    [{ title: 'x', dueDate: '2026-10-30', rrule: 'FREQ=DAILY' }, 'Invalid repeat rule'],
  ])('rejects %j', async (input, message) => {
    const err = await tasksRepo.create(input).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as InstanceType<typeof ValidationError>).issues[0]?.message).toBe(message);
  });
});

describe('completing tasks', () => {
  it('marks done, logs activity, and reopens', async () => {
    clock.set(at('2026-10-30'));
    const t = await tasksRepo.create({ title: 'Pay rent', dueDate: '2026-10-30' });
    const { task, next } = await tasksRepo.complete(t.id);
    expect(task).toMatchObject({ status: 'done', completedAt: at('2026-10-30') });
    expect(next).toBeNull();
    expect((await db.activity.toArray()).map((a) => a.type)).toContain('task.completed');

    const reopened = await tasksRepo.reopen(t.id);
    expect(reopened).toMatchObject({ status: 'todo', completedAt: null });
  });

  it('creates the next copy of a repeating task with an unticked checklist', async () => {
    clock.set(at('2026-10-30'));
    const t = await tasksRepo.create({
      title: 'Water plants',
      dueDate: '2026-10-30',
      rrule: daily('2026-10-30'),
      priority: 2,
      tagIds: ['tag-1'],
    });
    await tasksRepo.saveChecklist(t.id, [
      { text: 'Balcony', done: true },
      { text: 'Kitchen', done: true },
    ]);

    const { next } = await tasksRepo.complete(t.id);
    expect(next).toMatchObject({
      title: 'Water plants',
      status: 'todo',
      dueDate: '2026-10-31',
      priority: 2,
      tagIds: ['tag-1'],
      seriesId: t.id,
    });
    expect((await db.tasks.get(t.id))?.seriesId).toBe(t.id);
    const items = await tasksRepo.checklist(next!.id);
    expect(items.map((i) => [i.text, i.done])).toEqual([
      ['Balcony', 0],
      ['Kitchen', 0],
    ]);
    expect(searchIndex.search('water').map((h) => h.id)).toContain(next!.id);
  });

  it('does not duplicate the next copy if completed twice', async () => {
    clock.set(at('2026-10-30'));
    const t = await tasksRepo.create({
      title: 'Stretch',
      dueDate: '2026-10-30',
      rrule: daily('2026-10-30'),
    });
    const first = await tasksRepo.complete(t.id);
    await tasksRepo.reopen(t.id);
    const second = await tasksRepo.complete(t.id);
    expect(second.next?.id).toBe(first.next?.id);
    expect(await db.tasks.where('seriesId').equals(t.id).count()).toBe(2);
  });

  it('a late repeating task jumps to the future, not to another overdue day', () => {
    const rrule = daily('2026-10-20');
    expect(nextDueDate({ rrule, dueDate: '2026-10-25' }, '2026-10-30')).toBe('2026-10-31');
    expect(nextDueDate({ rrule, dueDate: '2026-11-05' }, '2026-10-30')).toBe('2026-11-06');
    expect(nextDueDate({ rrule: null, dueDate: '2026-11-05' }, '2026-10-30')).toBeNull();
  });
});

describe('postponing', () => {
  it('counts moves to a later date and remembers the original date', async () => {
    const t = await tasksRepo.create({ title: 'Essay', dueDate: '2026-10-30' });
    await tasksRepo.postpone(t.id, '2026-10-31');
    await tasksRepo.postpone(t.id, '2026-11-02');
    await tasksRepo.update(t.id, { dueDate: '2026-11-01' }); // earlier: not a postpone
    const after = await db.tasks.get(t.id);
    expect(after).toMatchObject({
      dueDate: '2026-11-01',
      postponeCount: 2,
      originalDueDate: '2026-10-30',
    });
    const log = (await db.activity.toArray()).filter((a) => a.type === 'task.postponed');
    expect(log).toHaveLength(2);
    expect(log[0]?.meta).toEqual({ from: '2026-10-30', to: '2026-10-31' });
  });

  it('giving an undated task a date is not a postpone', async () => {
    const t = await tasksRepo.create({ title: 'Someday' });
    await tasksRepo.update(t.id, { dueDate: '2026-12-01' });
    expect((await db.tasks.get(t.id))?.postponeCount).toBe(0);
  });
});

describe('checklists', () => {
  it('saves, reorders, edits and removes items', async () => {
    const t = await tasksRepo.create({ title: 'Pack' });
    await tasksRepo.saveChecklist(t.id, [
      { text: 'Passport', done: false },
      { text: '  ', done: false }, // blank lines are dropped
      { text: 'Charger', done: true },
    ]);
    let items = await tasksRepo.checklist(t.id);
    expect(items.map((i) => i.text)).toEqual(['Passport', 'Charger']);

    await tasksRepo.saveChecklist(t.id, [
      { id: items[1]!.id, text: 'Phone charger', done: true },
      { text: 'Snacks', done: false },
    ]);
    items = await tasksRepo.checklist(t.id);
    expect(items.map((i) => [i.text, i.done])).toEqual([
      ['Phone charger', 1],
      ['Snacks', 0],
    ]);

    await tasksRepo.toggleChecklistItem(items[1]!.id);
    expect((await db.checklistItems.get(items[1]!.id))?.done).toBe(1);
  });

  it('purging a task removes its checklist', async () => {
    const t = await tasksRepo.create({ title: 'Temp' });
    await tasksRepo.saveChecklist(t.id, [{ text: 'a', done: false }]);
    await tasksRepo.softDelete(t.id);
    expect((await listTrash()).map((i) => i.title)).toEqual(['Temp']);
    await tasksRepo.purge(t.id);
    expect(await db.checklistItems.count()).toBe(0);
  });
});
