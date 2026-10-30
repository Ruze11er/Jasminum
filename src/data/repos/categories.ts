import { chipColors } from '@/design-system/components/chipColors';
import { z } from '@/lib/validation';
import { db } from '../db';
import { createRepository } from '../repository';
import type { Category } from '../types';

/** Categories color-code tasks and events on the calendar (e.g. School, Work, Personal). */
export const categorySchema = z.object({
  name: z
    .string()
    .check(
      z.trim(),
      z.minLength(1, 'Name is required'),
      z.maxLength(30, 'Keep it under 30 characters'),
    ),
  color: z._default(z.enum(chipColors as [string, ...string[]]), 'pink'),
  icon: z._default(z.string().check(z.maxLength(40)), 'circle'),
  order: z._default(z.int().check(z.minimum(0)), 0),
});

export type CategoryInput = z.input<typeof categorySchema>;

const base = createRepository<Category, z.output<typeof categorySchema>, CategoryInput>({
  entityType: 'category',
  table: () => db.categories,
  schema: categorySchema,
});

export const categoriesRepo = {
  ...base,

  /** Active categories in the user's chosen order. */
  listActive: () =>
    db.categories
      .orderBy('order')
      .filter((c) => !c.deletedAt)
      .toArray(),
};
