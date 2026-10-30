import { describe, expect, it } from 'vitest';
import { clock, DAY_MS } from '@/lib/clock';
import { db } from './db';
import { categoriesRepo } from './repos/categories';
import { tagsRepo } from './repos/tags';
import { emptyTrash, listTrash, purgeExpiredTrash, restoreFromTrash } from './trash';

describe('trash', () => {
  it('lists deleted items across types, newest first, with expiry dates', async () => {
    const tag = await tagsRepo.ensure('Old tag');
    const cat = await categoriesRepo.create({ name: 'Old category' });
    await tagsRepo.ensure('Still here');
    clock.set(10 * DAY_MS);
    await tagsRepo.softDelete(tag.id);
    clock.set(11 * DAY_MS);
    await categoriesRepo.softDelete(cat.id);

    const items = await listTrash();
    expect(items.map((i) => [i.type, i.title])).toEqual([
      ['category', 'Old category'],
      ['tag', 'Old tag'],
    ]);
    expect(items[1]!.expiresAt).toBe(40 * DAY_MS);
  });

  it('restores items', async () => {
    const tag = await tagsRepo.ensure('Back');
    await tagsRepo.softDelete(tag.id);
    await restoreFromTrash({ type: 'tag', id: tag.id });
    expect(await listTrash()).toEqual([]);
    expect((await db.tags.get(tag.id))?.deletedAt).toBeNull();
  });

  it('erases only items past the 30-day retention', async () => {
    const old = await tagsRepo.ensure('Old');
    const recent = await tagsRepo.ensure('Recent');
    clock.set(1 * DAY_MS);
    await tagsRepo.softDelete(old.id);
    clock.set(25 * DAY_MS);
    await tagsRepo.softDelete(recent.id);

    expect(await purgeExpiredTrash(31 * DAY_MS)).toBe(1);
    expect(await db.tags.get(old.id)).toBeUndefined();
    expect(await db.tags.get(recent.id)).toBeDefined();
  });

  it('empties everything', async () => {
    for (const name of ['a', 'b', 'c']) {
      const t = await tagsRepo.ensure(name);
      await tagsRepo.softDelete(t.id);
    }
    expect(await emptyTrash()).toBe(3);
    expect(await db.tags.count()).toBe(0);
  });
});
