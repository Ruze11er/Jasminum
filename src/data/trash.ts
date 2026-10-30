import type { Table } from 'dexie';
import { clock, DAY_MS } from '@/lib/clock';
import { categoriesRepo } from './repos/categories';
import { tagsRepo } from './repos/tags';
import { tasksRepo } from './repos/tasks';
import type { BaseEntity, EntityType } from './types';
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

export const deleteForever = (item: Pick<TrashItem, 'type' | 'id'>) =>
  sourceFor(item.type).purge(item.id);

export async function emptyTrash(): Promise<number> {
  const items = await listTrash();
  for (const item of items) await deleteForever(item);
  return items.length;
}

/** Erases items that have been in the Trash longer than the retention period. Runs at startup. */
export async function purgeExpiredTrash(now = clock.now()): Promise<number> {
  const items = await listTrash();
  const expired = items.filter((i) => i.expiresAt <= now);
  for (const item of expired) await deleteForever(item);
  return expired.length;
}
