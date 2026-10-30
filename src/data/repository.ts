import type { Table } from 'dexie';
import type { Schema } from '@/lib/validation';
import { clock } from '@/lib/clock';
import { uuidv7 } from '@/lib/ids';
import { logActivity } from './activity';
import { db } from './db';
import { searchIndex, searchKey, type SearchFields } from './search/searchIndex';
import type { BaseEntity, EntityType } from './types';

// Not "NotFoundError": Dexie treats that name as a browser error and replaces it.
export class EntityNotFoundError extends Error {
  constructor(type: EntityType, id: string) {
    super(`${type} ${id} not found`);
    this.name = 'EntityNotFoundError';
  }
}

/**
 * T  = the stored record.
 * I  = the validated fields that get stored (schema output).
 * In = what callers pass in (schema input; may be looser, e.g. untrimmed or with defaults).
 */
export interface RepositoryConfig<T extends BaseEntity, I, In = I> {
  entityType: EntityType;
  table: () => Table<T, string>;
  /** Validates and normalizes the user-editable fields (everything except id/timestamps). */
  schema: Schema<I, In>;
  /** What the search index should know about a record. Omit if not searchable. */
  toSearch?: (entity: T) => SearchFields;
  /** Log every edit to the activity log (on for notes; off for noisy entities). */
  logUpdates?: boolean;
  /** Extra tables that `cascadePurge` touches inside the purge transaction. */
  cascadeTables?: () => Table[];
  /** Deletes dependent rows (e.g. a task's checklist items) in the same transaction. */
  cascadePurge?: (entity: T) => Promise<void>;
  /** Runs after a purge commits, for non-database cleanup such as deleting file bytes. */
  afterPurge?: (entity: T) => Promise<void>;
}

const baseKeys = ['id', 'createdAt', 'updatedAt', 'deletedAt'] as const;

function stripBase<T extends BaseEntity>(entity: T): Omit<T, keyof BaseEntity> {
  const copy = { ...entity } as Record<string, unknown>;
  for (const k of baseKeys) delete copy[k];
  return copy as Omit<T, keyof BaseEntity>;
}

/**
 * The only way features write data. Every write:
 * - validates input with Zod,
 * - sets ids and timestamps,
 * - soft-deletes into the Trash instead of erasing,
 * - logs activity in the same transaction,
 * - keeps the search index up to date after commit.
 */
export function createRepository<T extends BaseEntity & I, I extends object, In = I>(
  config: RepositoryConfig<T, I, In>,
) {
  const { entityType } = config;
  const table = () => config.table();
  const txTables = () => [table(), db.activity];

  const indexSearch = (entity: T) => {
    if (!config.toSearch) return;
    if (entity.deletedAt) searchIndex.remove(entityType, entity.id);
    else
      searchIndex.upsert({
        key: searchKey(entityType, entity.id),
        type: entityType,
        id: entity.id,
        ...config.toSearch(entity),
      });
  };

  if (config.toSearch) {
    const toSearch = config.toSearch;
    searchIndex.registerSource(entityType, async () => {
      const rows = await table()
        .filter((e) => !e.deletedAt)
        .toArray();
      return rows.map((e) => ({
        key: searchKey(entityType, e.id),
        type: entityType,
        id: e.id,
        ...toSearch(e),
      }));
    });
  }

  async function mustGet(id: string): Promise<T> {
    const entity = await table().get(id);
    if (!entity) throw new EntityNotFoundError(entityType, id);
    return entity;
  }

  const repo = {
    entityType,

    get: (id: string) => table().get(id),

    async create(input: In): Promise<T> {
      const fields = config.schema.parse(input);
      const now = clock.now();
      const entity = {
        ...fields,
        id: uuidv7(now),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      } as T;
      await db.transaction('rw', txTables(), async () => {
        await table().add(entity);
        await logActivity(`${entityType}.created`, entityType, entity.id);
      });
      indexSearch(entity);
      return entity;
    },

    /** Merges the patch, then re-validates the whole record so it can never become invalid. */
    async update(id: string, patch: Partial<In>): Promise<T> {
      let updated!: T;
      await db.transaction('rw', txTables(), async () => {
        const existing = await mustGet(id);
        const fields = config.schema.parse({ ...stripBase(existing), ...patch });
        updated = { ...existing, ...fields, updatedAt: clock.now() };
        await table().put(updated);
        if (config.logUpdates) await logActivity(`${entityType}.updated`, entityType, id);
      });
      indexSearch(updated);
      return updated;
    },

    /** Moves to Trash. Recoverable for 30 days. */
    async softDelete(id: string): Promise<void> {
      let entity!: T;
      await db.transaction('rw', txTables(), async () => {
        const existing = await mustGet(id);
        if (existing.deletedAt) return;
        const now = clock.now();
        entity = { ...existing, deletedAt: now, updatedAt: now };
        await table().put(entity);
        await logActivity(`${entityType}.deleted`, entityType, id);
      });
      if (entity) indexSearch(entity);
    },

    async restore(id: string): Promise<void> {
      let entity!: T;
      await db.transaction('rw', txTables(), async () => {
        const existing = await mustGet(id);
        if (!existing.deletedAt) return;
        entity = { ...existing, deletedAt: null, updatedAt: clock.now() };
        await table().put(entity);
        await logActivity(`${entityType}.restored`, entityType, id);
      });
      if (entity) indexSearch(entity);
    },

    /** Erases for good, including links to and from it. Used by the Trash only. */
    async purge(id: string): Promise<void> {
      const extra = config.cascadeTables?.() ?? [];
      let entity: T | undefined;
      await db.transaction('rw', [...txTables(), db.links, ...extra], async () => {
        entity = await table().get(id);
        if (!entity) return;
        await config.cascadePurge?.(entity);
        await db.links.where('[fromType+fromId]').equals([entityType, id]).delete();
        await db.links.where('[toType+toId]').equals([entityType, id]).delete();
        await table().delete(id);
        await logActivity(`${entityType}.purged`, entityType, id);
      });
      searchIndex.remove(entityType, id);
      if (entity) await config.afterPurge?.(entity);
    },
  };
  return repo;
}

export type Repository<T extends BaseEntity & I, I extends object, In = I> = ReturnType<
  typeof createRepository<T, I, In>
>;
