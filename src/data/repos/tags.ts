import { chipColors } from '@/design-system/components/chipColors';
import { z } from '@/lib/validation';
import { db } from '../db';
import { createRepository } from '../repository';
import type { Tag } from '../types';

/** "  #Biology   Notes " → display "Biology Notes", uniqueness key "biology notes". */
export function normalizeTagName(name: string) {
  const display = name.trim().replace(/^#+/, '').trim().replace(/\s+/g, ' ');
  return { display, key: display.toLocaleLowerCase() };
}

const colorSchema = z.enum(chipColors as [string, ...string[]]);

export const tagSchema = z.pipe(
  z.pipe(
    z.object({ name: z.string(), color: z._default(colorSchema, 'pink') }),
    z.transform(({ name, color }) => {
      const { display, key } = normalizeTagName(name);
      return { name: display, normalizedName: key, color };
    }),
  ),
  z.object({
    name: z
      .string()
      .check(
        z.minLength(1, 'Tag name is required'),
        z.maxLength(40, 'Keep tags under 40 characters'),
      ),
    normalizedName: z.string().check(z.minLength(1)),
    color: colorSchema,
  }),
);

export type TagInput = z.input<typeof tagSchema>;
type TagFields = z.output<typeof tagSchema>;

const base = createRepository<Tag, TagFields, TagInput>({
  entityType: 'tag',
  table: () => db.tags,
  schema: tagSchema,
  toSearch: (t) => ({ title: t.name, tags: t.name }),
});

export const tagsRepo = {
  ...base,

  findByName: (name: string) =>
    db.tags.where('normalizedName').equals(normalizeTagName(name).key).first(),

  /**
   * Returns the tag with this name, creating it if needed. A matching tag in the Trash
   * is restored rather than failing on the unique name.
   */
  async ensure(name: string, color?: string): Promise<Tag> {
    const existing = await tagsRepo.findByName(name);
    if (existing) {
      if (existing.deletedAt) await base.restore(existing.id);
      return (await base.get(existing.id))!;
    }
    return base.create({ name, color });
  },

  /** Active tags, alphabetical. */
  listActive: () =>
    db.tags
      .orderBy('normalizedName')
      .filter((t) => !t.deletedAt)
      .toArray(),
};
