import { chipColors } from '@/design-system/components/chipColors';
import { z } from '@/lib/validation';
import { db } from '../db';
import { createRepository } from '../repository';
import type { Folder, FolderScope } from '../types';

/** Folders give notes (and, from Phase 6, documents) a single home. */
export const folderSchema = z.object({
  name: z
    .string()
    .check(
      z.trim(),
      z.minLength(1, 'Give the folder a name'),
      z.maxLength(40, 'Keep folder names under 40 characters'),
    ),
  parentId: z._default(z.nullable(z.string()), null),
  scope: z.enum(['notes', 'documents']),
  order: z._default(z.number(), 0),
  color: z._default(z.nullable(z.enum(chipColors as [string, ...string[]])), null),
  icon: z._default(z.nullable(z.string().check(z.maxLength(40))), null),
});

export type FolderInput = z.input<typeof folderSchema>;
type FolderFields = z.output<typeof folderSchema>;

const base = createRepository<Folder, FolderFields, FolderInput>({
  entityType: 'folder',
  table: () => db.folders,
  schema: folderSchema,
  /*
   * Moving a folder to the Trash leaves its notes alone (they show under "All notes"
   * meanwhile, and are back in place if the folder is restored). Erasing the folder for
   * good just takes its notes and documents out of it.
   */
  cascadeTables: () => [db.notes, db.documents],
  cascadePurge: async (f) => {
    await db.notes.where('folderId').equals(f.id).modify({ folderId: null });
    await db.documents.where('folderId').equals(f.id).modify({ folderId: null });
  },
});

export const foldersRepo = {
  ...base,

  /** Active folders of one kind, in the user's order (then by name). */
  async list(scope: FolderScope): Promise<Folder[]> {
    const rows = await db.folders
      .where('scope')
      .equals(scope)
      .filter((f) => !f.deletedAt)
      .toArray();
    return rows.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  },

  /** Adds a folder at the end of the list. */
  async add(scope: FolderScope, name: string): Promise<Folder> {
    const existing = await foldersRepo.list(scope);
    return base.create({ scope, name, order: existing.length });
  },
};
