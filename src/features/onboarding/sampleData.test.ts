import { describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { getSetting } from '@/data/repos/settings';
import { tasksRepo } from '@/data/repos/tasks';
import { clock } from '@/lib/clock';
import { addSampleData, removeSampleData, restoreSampleData, SAMPLE_TAG } from './sampleData';

const NOON = new Date('2026-10-30T12:00:00').getTime();
const active = <T extends { deletedAt: number | null }>(rows: T[]) =>
  rows.filter((r) => !r.deletedAt);

describe('sample data', () => {
  it('adds tagged tasks, events and a note', async () => {
    clock.set(NOON);
    expect(await addSampleData()).toBe(true);

    const tag = await db.tags.where('normalizedName').equals('sample').first();
    expect(tag?.name).toBe(SAMPLE_TAG);
    expect(await getSetting('sampleData')).toEqual({ tagId: tag!.id });

    const tasks = await db.tasks.toArray();
    const events = await db.events.toArray();
    const notes = await db.notes.toArray();
    expect(tasks.length).toBeGreaterThanOrEqual(3);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(notes).toHaveLength(1);
    for (const row of [...tasks, ...events, ...notes]) expect(row.tagIds).toEqual([tag!.id]);
    // Something is due today, so Home isn't empty.
    expect(tasks.some((t) => t.dueDate === '2026-10-30')).toBe(true);
    expect(await db.checklistItems.count()).toBe(2);
  });

  it('is added only once', async () => {
    clock.set(NOON);
    await addSampleData();
    const count = await db.tasks.count();
    expect(await addSampleData()).toBe(false);
    expect(await db.tasks.count()).toBe(count);
  });

  it('removes everything with the tag, including repeats made since', async () => {
    clock.set(NOON);
    await addSampleData();
    const mine = await tasksRepo.create({ title: 'My own task' });
    const repeating = (await db.tasks.toArray()).find((t) => t.rrule)!;
    await tasksRepo.complete(repeating.id); // creates the next copy, still tagged

    const removed = await removeSampleData();
    expect(removed!.count).toBeGreaterThanOrEqual(6);
    expect(active(await db.tasks.toArray()).map((t) => t.id)).toEqual([mine.id]);
    expect(active(await db.events.toArray())).toEqual([]);
    expect(active(await db.notes.toArray())).toEqual([]);
    expect(active(await db.tags.toArray())).toEqual([]);
    expect(await getSetting('sampleData')).toBeNull();
    // Removed items wait in the Trash like anything else.
    expect(await db.tasks.where('deletedAt').above(0).count()).toBeGreaterThan(0);
  });

  it('can be added again after removing it', async () => {
    clock.set(NOON);
    await addSampleData();
    await removeSampleData();
    expect(await addSampleData()).toBe(true);
    expect(active(await db.tags.toArray())).toHaveLength(1);
  });

  it('undo brings the removed items back', async () => {
    clock.set(NOON);
    await addSampleData();
    const before = active(await db.tasks.toArray()).length;
    const removed = await removeSampleData();
    await restoreSampleData(removed!);
    expect(active(await db.tasks.toArray())).toHaveLength(before);
    expect(active(await db.notes.toArray())).toHaveLength(1);
    expect(await getSetting('sampleData')).toEqual({ tagId: removed!.tagId });
  });

  it('removing without sample data does nothing', async () => {
    expect(await removeSampleData()).toBeNull();
  });
});
