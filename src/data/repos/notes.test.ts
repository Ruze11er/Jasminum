import { describe, expect, it } from 'vitest';
import { clock } from '@/lib/clock';
import { ValidationError } from '@/lib/validation';
import { db } from '../db';
import { searchIndex } from '../search/searchIndex';
import { deleteForever, listTrash, restoreFromTrash } from '../trash';
import { eventsRepo } from './events';
import { foldersRepo } from './folders';
import { InvalidLinkError, linksRepo } from './links';
import { EDIT_SESSION_GAP_MS, notesRepo, noteTitle } from './notes';
import { tasksRepo } from './tasks';

const T0 = new Date('2026-11-02T10:00:00').getTime();

describe('notes', () => {
  it('fills defaults and allows untitled notes', async () => {
    const n = await notesRepo.create({ contentText: 'Mitochondria is the powerhouse' });
    expect(n).toMatchObject({
      title: '',
      contentJson: null,
      folderId: null,
      tagIds: [],
      pinned: 0,
      favorite: 0,
    });
    expect(noteTitle(n)).toBe('Mitochondria is the powerhouse');
    expect(noteTitle({ title: '', contentText: '  \n ' })).toBe('');
    expect(noteTitle({ title: '', contentText: 'x'.repeat(100) })).toHaveLength(80);
    expect(notesRepo.isEmpty({ title: ' ', contentText: '\n' })).toBe(true);
  });

  it('validates title and text length', async () => {
    await expect(notesRepo.create({ title: 'x'.repeat(201) })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(notesRepo.create({ contentText: 'x'.repeat(200_001) })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('is searchable by its content, and leaves search when deleted', async () => {
    const n = await notesRepo.create({ title: 'Biology', contentText: 'Photosynthesis in leaves' });
    expect(searchIndex.search('photosynthesis', { types: ['note'] }).map((h) => h.id)).toEqual([
      n.id,
    ]);
    await notesRepo.update(n.id, { contentText: 'Cell respiration' });
    expect(searchIndex.search('photosynthesis')).toEqual([]);
    expect(searchIndex.search('respiration').map((h) => h.id)).toEqual([n.id]);
    await notesRepo.softDelete(n.id);
    expect(searchIndex.search('respiration')).toEqual([]);
  });

  it('logs one edit per editing session, not per autosave', async () => {
    clock.set(T0);
    const n = await notesRepo.create({ title: 'Draft' });
    for (let i = 1; i <= 5; i++) {
      clock.set(T0 + i * 2000);
      await notesRepo.update(n.id, { contentText: `typing ${i}` });
    }
    clock.set(T0 + 10_000 + EDIT_SESSION_GAP_MS);
    await notesRepo.update(n.id, { contentText: 'back later' });
    const types = (await db.activity.toArray()).map((a) => a.type);
    expect(types).toEqual(['note.created', 'note.updated']);
  });

  it('pins, favorites and moves notes', async () => {
    const folder = await foldersRepo.add('notes', 'School');
    const n = await notesRepo.create({ title: 'Plan' });
    expect((await notesRepo.togglePinned(n)).pinned).toBe(1);
    expect((await notesRepo.toggleFavorite(n)).favorite).toBe(1);
    await notesRepo.moveToFolder([n.id], folder.id);
    expect((await db.notes.get(n.id))?.folderId).toBe(folder.id);
  });

  it('goes to the Trash with its title or first line', async () => {
    const n = await notesRepo.create({ contentText: 'Shopping list\nmilk' });
    await notesRepo.softDelete(n.id);
    expect(await listTrash()).toMatchObject([{ type: 'note', title: 'Shopping list' }]);
    await restoreFromTrash({ type: 'note', id: n.id });
    expect((await db.notes.get(n.id))?.deletedAt).toBeNull();
  });
});

describe('folders', () => {
  it('validates names and lists active folders in order', async () => {
    await expect(foldersRepo.add('notes', '  ')).rejects.toBeInstanceOf(ValidationError);
    const a = await foldersRepo.add('notes', 'School');
    const b = await foldersRepo.add('notes', 'Recipes');
    await foldersRepo.add('documents', 'Papers');
    expect((await foldersRepo.list('notes')).map((f) => f.name)).toEqual(['School', 'Recipes']);
    expect(b.order).toBe(1);
    await foldersRepo.softDelete(a.id);
    expect((await foldersRepo.list('notes')).map((f) => f.name)).toEqual(['Recipes']);
  });

  it('keeps notes in a trashed folder, and empties the folder when erased', async () => {
    const folder = await foldersRepo.add('notes', 'School');
    const n = await notesRepo.create({ title: 'Essay', folderId: folder.id });
    await foldersRepo.softDelete(folder.id);
    expect((await db.notes.get(n.id))?.folderId).toBe(folder.id);
    expect(await listTrash()).toMatchObject([{ type: 'folder', title: 'School' }]);

    await deleteForever({ type: 'folder', id: folder.id });
    expect(await db.folders.get(folder.id)).toBeUndefined();
    expect((await db.notes.get(n.id))?.folderId).toBeNull();
  });
});

describe('links', () => {
  it('links items once and finds them from both ends', async () => {
    const note = await notesRepo.create({ title: 'Lab notes' });
    const task = await tasksRepo.create({ title: 'Write lab report' });
    const event = await eventsRepo.create({
      title: 'Lab',
      allDay: 1,
      start: '2026-11-03',
      end: '2026-11-03',
    });

    const first = await linksRepo.link(
      { type: 'note', id: note.id },
      { type: 'task', id: task.id },
    );
    const again = await linksRepo.link(
      { type: 'task', id: task.id },
      { type: 'note', id: note.id },
    );
    expect(again.id).toBe(first.id);
    await linksRepo.link({ type: 'event', id: event.id }, { type: 'note', id: note.id });

    expect(
      (await linksRepo.linksOf({ type: 'note', id: note.id })).map((l) => [l.type, l.id]),
    ).toEqual([
      ['task', task.id],
      ['event', event.id],
    ]);
    expect((await linksRepo.linksOf({ type: 'task', id: task.id })).map((l) => l.id)).toEqual([
      note.id,
    ]);
    expect((await linksRepo.linksOf({ type: 'event', id: event.id })).map((l) => l.id)).toEqual([
      note.id,
    ]);
  });

  it('rejects self-links and missing items', async () => {
    const note = await notesRepo.create({ title: 'x' });
    await expect(
      linksRepo.link({ type: 'note', id: note.id }, { type: 'note', id: note.id }),
    ).rejects.toBeInstanceOf(InvalidLinkError);
    await expect(
      linksRepo.link({ type: 'note', id: note.id }, { type: 'task', id: 'nope' }),
    ).rejects.toThrow('task nope not found');
  });

  it('unlinks with undo, and erasing an item removes its links', async () => {
    const note = await notesRepo.create({ title: 'x' });
    const task = await tasksRepo.create({ title: 'y' });
    const link = await linksRepo.link({ type: 'note', id: note.id }, { type: 'task', id: task.id });
    await linksRepo.unlink(link.id);
    expect(await linksRepo.linksOf({ type: 'task', id: task.id })).toEqual([]);
    await linksRepo.restoreLink(link);
    expect(await linksRepo.linksOf({ type: 'task', id: task.id })).toHaveLength(1);

    await tasksRepo.softDelete(task.id);
    await deleteForever({ type: 'task', id: task.id });
    expect(await linksRepo.linksOf({ type: 'note', id: note.id })).toEqual([]);
  });
});
