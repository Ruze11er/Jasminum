import { describe, expect, it } from 'vitest';
import { ValidationError } from '@/lib/validation';
import { clock } from '@/lib/clock';
import { db } from './db';
import { categoriesRepo } from './repos/categories';
import { normalizeTagName, tagsRepo } from './repos/tags';
import { EntityNotFoundError } from './repository';
import { searchIndex } from './search/searchIndex';

describe('repository basics (via categories)', () => {
  it('creates a record with id, timestamps, defaults and an activity entry', async () => {
    clock.set(1_000);
    const cat = await categoriesRepo.create({ name: '  School  ' });
    expect(cat).toMatchObject({
      name: 'School',
      color: 'pink',
      icon: 'circle',
      order: 0,
      createdAt: 1_000,
      updatedAt: 1_000,
      deletedAt: null,
    });
    expect(await db.categories.get(cat.id)).toEqual(cat);
    const log = await db.activity.toArray();
    expect(log).toEqual([
      expect.objectContaining({
        type: 'category.created',
        entityType: 'category',
        entityId: cat.id,
        at: 1_000,
      }),
    ]);
  });

  it('rejects invalid input and writes nothing', async () => {
    await expect(categoriesRepo.create({ name: '   ' })).rejects.toBeInstanceOf(ValidationError);
    await expect(categoriesRepo.create({ name: 'x', color: 'neon' })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(await db.categories.count()).toBe(0);
    expect(await db.activity.count()).toBe(0);
  });

  it('updates by merging and re-validating the whole record', async () => {
    clock.set(1_000);
    const cat = await categoriesRepo.create({ name: 'Work', color: 'sky' });
    clock.set(2_000);
    const updated = await categoriesRepo.update(cat.id, { name: 'Job' });
    expect(updated).toMatchObject({
      name: 'Job',
      color: 'sky',
      createdAt: 1_000,
      updatedAt: 2_000,
    });
    await expect(categoriesRepo.update(cat.id, { name: '' })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect((await db.categories.get(cat.id))?.name).toBe('Job');
  });

  it('throws EntityNotFoundError for unknown ids', async () => {
    await expect(categoriesRepo.update('missing', { name: 'x' })).rejects.toBeInstanceOf(
      EntityNotFoundError,
    );
  });

  it('soft-deletes and restores', async () => {
    clock.set(1_000);
    const cat = await categoriesRepo.create({ name: 'Home' });
    clock.set(5_000);
    await categoriesRepo.softDelete(cat.id);
    expect((await db.categories.get(cat.id))?.deletedAt).toBe(5_000);
    expect(await categoriesRepo.listActive()).toEqual([]);

    clock.set(6_000);
    await categoriesRepo.restore(cat.id);
    expect((await db.categories.get(cat.id))?.deletedAt).toBeNull();
    expect((await categoriesRepo.listActive()).map((c) => c.name)).toEqual(['Home']);

    const types = (await db.activity.orderBy('at').toArray()).map((a) => a.type);
    expect(types).toEqual(['category.created', 'category.deleted', 'category.restored']);
  });

  it('purges the record and every link pointing to or from it', async () => {
    const cat = await categoriesRepo.create({ name: 'Temp' });
    await db.links.bulkAdd([
      { id: 'l1', fromType: 'category', fromId: cat.id, toType: 'note', toId: 'n1', createdAt: 0 },
      { id: 'l2', fromType: 'task', fromId: 't1', toType: 'category', toId: cat.id, createdAt: 0 },
      { id: 'l3', fromType: 'task', fromId: 't1', toType: 'note', toId: 'n1', createdAt: 0 },
    ]);
    await categoriesRepo.purge(cat.id);
    expect(await db.categories.get(cat.id)).toBeUndefined();
    expect((await db.links.toArray()).map((l) => l.id)).toEqual(['l3']);
  });
});

describe('tags', () => {
  it('normalizes names', () => {
    expect(normalizeTagName('  #Biology   Notes ')).toEqual({
      display: 'Biology Notes',
      key: 'biology notes',
    });
  });

  it('ensure() reuses existing tags case-insensitively', async () => {
    const a = await tagsRepo.ensure('Biology');
    const b = await tagsRepo.ensure('  biology ');
    expect(b.id).toBe(a.id);
    expect(await db.tags.count()).toBe(1);
  });

  it('ensure() restores a tag from the Trash instead of failing on the unique name', async () => {
    const tag = await tagsRepo.ensure('Exam');
    await tagsRepo.softDelete(tag.id);
    const again = await tagsRepo.ensure('exam');
    expect(again.id).toBe(tag.id);
    expect(again.deletedAt).toBeNull();
  });

  it('enforces unique names on create', async () => {
    await tagsRepo.create({ name: 'Math' });
    await expect(tagsRepo.create({ name: 'MATH' })).rejects.toThrow();
  });

  it('lists active tags alphabetically', async () => {
    await tagsRepo.ensure('zoo');
    await tagsRepo.ensure('Apple');
    const gone = await tagsRepo.ensure('middle');
    await tagsRepo.softDelete(gone.id);
    expect((await tagsRepo.listActive()).map((t) => t.name)).toEqual(['Apple', 'zoo']);
  });
});

describe('search index integration', () => {
  it('tracks creates, renames, deletes and restores', async () => {
    const tag = await tagsRepo.ensure('Chemistry');
    expect(searchIndex.search('chem').map((h) => h.id)).toEqual([tag.id]);

    await tagsRepo.update(tag.id, { name: 'Physics' });
    expect(searchIndex.search('chemistry')).toEqual([]);
    expect(searchIndex.search('phys')[0]?.title).toBe('Physics');

    await tagsRepo.softDelete(tag.id);
    expect(searchIndex.search('physics')).toEqual([]);

    await tagsRepo.restore(tag.id);
    expect(searchIndex.search('physics')).toHaveLength(1);
  });

  it('rebuilds from the database, skipping deleted records', async () => {
    await tagsRepo.ensure('History');
    const gone = await tagsRepo.ensure('Hidden');
    await tagsRepo.softDelete(gone.id);
    searchIndex.resetForTests();
    expect(searchIndex.search('history')).toEqual([]);

    await searchIndex.rebuild();
    expect(searchIndex.search('history')).toHaveLength(1);
    expect(searchIndex.search('hidden')).toEqual([]);
  });

  it('tolerates typos', async () => {
    await tagsRepo.ensure('Mathematics');
    expect(searchIndex.search('mathematcs')).toHaveLength(1);
  });
});
