import type { Table } from 'dexie';
import { clock, DAY_MS } from '@/lib/clock';
import { categoriesRepo } from './repos/categories';
import { documentsRepo } from './repos/documents';
import { eventsRepo } from './repos/events';
import { foldersRepo } from './repos/folders';
import { notesRepo, noteTitle } from './repos/notes';
import { tagsRepo } from './repos/tags';
import { tasksRepo } from './repos/tasks';
import type { BaseEntity, EntityType, Note } from './types';
import { db } from './db';

export const TRASH_RETENTION_DAYS = 30;

interface TrashSource {
  type: EntityType;
  label: string;
  table: () => Table<BaseEntity, string>;
  title: (entity: BaseEntity) => string;
  restore: (id: string) => Promise<void>;
  purge: (id: string) => Promise<void>;
}

const named = (e: BaseEntity) => (e as unknown as { name: string }).name;

/**
 * Everything that can sit in the Trash. Each feature phase adds its entity here
 * (tasks, events, notes, folders, documents) once its repository exists.
 */
export const trashSources: TrashSource[] = [
  {
    type: 'task',
    label: 'Task',
    table: () => db.tasks as unknown as Table<BaseEntity, string>,
    title: (e) => (e as unknown as { title: string }).title,
    restore: tasksRepo.restore,
    purge: tasksRepo.purge,
  },
  {
    type: 'event',
    label: 'Event',
    table: () => db.events as unknown as Table<BaseEntity, string>,
    title: (e) => (e as unknown as { title: string }).title,
    restore: eventsRepo.restore,
    purge: eventsRepo.purge,
  },
  {
    type: 'note',
    label: 'Note',
    table: () => db.notes as unknown as Table<BaseEntity, string>,
    title: (e) => noteTitle(e as unknown as Note),
    restore: notesRepo.restore,
    purge: notesRepo.purge,
  },
  {
    type: 'document',
    label: 'File',
    table: () => db.documents as unknown as Table<BaseEntity, string>,
    title: (e) => (e as unknown as { title: string }).title,
    restore: documentsRepo.restore,
    purge: documentsRepo.purge,
  },
  {
    type: 'folder',
    label: 'Folder',
    table: () => db.folders as unknown as Table<BaseEntity, string>,
    title: named,
    restore: foldersRepo.restore,
    purge: foldersRepo.purge,
  },
  {
    type: 'tag',
    label: 'Tag',
    table: () => db.tags as unknown as Table<BaseEntity, string>,
    title: named,
    restore: tagsRepo.restore,
    purge: tagsRepo.purge,
  },
  {
    type: 'category',
    label: 'Category',
    table: () => db.categories as unknown as Table<BaseEntity, string>,
    title: named,
    restore: categoriesRepo.restore,
    purge: categoriesRepo.purge,
  },
];

export interface TrashItem {
  type: EntityType;
  label: string;
  id: string;
  title: string;
  deletedAt: number;
  /** When it will be erased automatically. */
  expiresAt: number;
}

const sourceFor = (type: EntityType) => {
  const source = trashSources.find((s) => s.type === type);
  if (!source) throw new Error(`No trash source for ${type}`);
  return source;
};

/** Everything in the Trash, most recently deleted first. */
export async function listTrash(): Promise<TrashItem[]> {
  const groups = await Promise.all(
    trashSources.map(async (s) => {
      // Active rows have deletedAt = null, which IndexedDB doesn't index, so this only
      // reads deleted rows.
      const rows = await s.table().where('deletedAt').above(0).toArray();
      return rows.map((e) => ({
        type: s.type,
        label: s.label,
        id: e.id,
        title: s.title(e) || 'Untitled',
        deletedAt: e.deletedAt!,
        expiresAt: e.deletedAt! + TRASH_RETENTION_DAYS * DAY_MS,
      }));
    }),
  );
  return groups.flat().sort((a, b) => b.deletedAt - a.deletedAt);
}

export const restoreFromTrash = (item: Pick<TrashItem, 'type' | 'id'>) =>
  sourceFor(item.type).restore(item.id);

const purge = (item: Pick<TrashItem, 'type' | 'id'>) => sourceFor(item.type).purge(item.id);

/**
 * The safety copies taken before a restore may still hold what the user just erased, so
 * erasing on purpose removes them too ("erased for good" must be true).
 */
const forgetSnapshots = async () => (await import('./backup/snapshots')).deleteAllSnapshots();

/** Erases one item for good, at the user's request. */
export async function deleteForever(item: Pick<TrashItem, 'type' | 'id'>): Promise<void> {
  await purge(item);
  await forgetSnapshots();
}

export async function emptyTrash(): Promise<number> {
  const items = await listTrash();
  for (const item of items) await purge(item);
  await forgetSnapshots();
  return items.length;
}

/**
 * Erases items that have been in the Trash longer than the retention period. Runs at
 * startup. Snapshots are left alone here: they expire on their own within a week.
 */
export async function purgeExpiredTrash(now = clock.now()): Promise<number> {
  const items = await listTrash();
  const expired = items.filter((i) => i.expiresAt <= now);
  for (const item of expired) await purge(item);
  return expired.length;
}
