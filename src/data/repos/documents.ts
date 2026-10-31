import { clock } from '@/lib/clock';
import { DOCUMENT_KINDS } from '@/lib/fileKinds';
import { z } from '@/lib/validation';
import { logActivity } from '../activity';
import { db } from '../db';
import { getFileStore } from '../files';
import { createRepository, EntityNotFoundError } from '../repository';
import type { DocumentKind, LibraryDocument } from '../types';

const flag = z._default(z.union([z.literal(0), z.literal(1)]), 0);
const nullableNumber = z._default(z.nullable(z.number()), null);

export const documentSchema = z.object({
  title: z
    .string()
    .check(
      z.trim(),
      z.minLength(1, 'Give the file a name'),
      z.maxLength(200, 'Keep the name under 200 characters'),
    ),
  originalFilename: z.string().check(z.maxLength(255)),
  mimeType: z._default(z.string().check(z.maxLength(255)), ''),
  ext: z._default(z.string().check(z.maxLength(12)), ''),
  kind: z.enum(DOCUMENT_KINDS as [DocumentKind, ...DocumentKind[]]),
  size: z.int().check(z.minimum(0)),
  hash: z.string().check(z.regex(/^[0-9a-f]{64}$/, 'Invalid file hash')),
  storageKey: z.string().check(z.regex(/^sha256-[0-9a-f]{64}$/, 'Invalid storage key')),
  thumbKey: z._default(z.nullable(z.string()), null),
  folderId: z._default(z.nullable(z.string()), null),
  tagIds: z._default(z.array(z.string()), []),
  description: z._default(
    z.string().check(z.maxLength(2000, 'Keep the description under 2,000 characters')),
    '',
  ),
  favorite: flag,
  addedAt: z.number(),
  lastOpenedAt: nullableNumber,
  openCount: z._default(z.int().check(z.minimum(0)), 0),
  fileMissing: flag,
});

export type DocumentInput = z.input<typeof documentSchema>;
type DocumentFields = z.output<typeof documentSchema>;

const base = createRepository<LibraryDocument, DocumentFields, DocumentInput>({
  entityType: 'document',
  table: () => db.documents,
  schema: documentSchema,
  toSearch: (d) => ({
    title: d.title,
    body: [d.originalFilename, d.description].filter(Boolean).join('\n'),
  }),
  // Duplicates kept on purpose share the same stored bytes (content-addressed), so the
  // bytes are deleted only when no other document, even one in the Trash, still uses them.
  afterPurge: async (d) => {
    const stillUsed = await db.documents.filter((o) => o.storageKey === d.storageKey).count();
    if (!stillUsed) await (await getFileStore()).delete(d.storageKey);
  },
});

export const documentsRepo = {
  ...base,

  /** Active documents with the same content, for duplicate warnings. */
  findByHash: (hash: string) =>
    db.documents
      .where('hash')
      .equals(hash)
      .filter((d) => !d.deletedAt)
      .toArray(),

  /** The stored bytes. Marks the document as missing (and returns null) if they're gone. */
  async file(doc: LibraryDocument): Promise<Blob | null> {
    const blob = await (await getFileStore()).get(doc.storageKey);
    if (!blob && !doc.fileMissing) await db.documents.update(doc.id, { fileMissing: 1 });
    if (blob && doc.fileMissing) await db.documents.update(doc.id, { fileMissing: 0 });
    return blob;
  },

  /** Counts an open, for "Recently opened" and insights. Doesn't change "last edited". */
  async markOpened(id: string): Promise<void> {
    await db.transaction('rw', [db.documents, db.activity], async () => {
      const doc = await db.documents.get(id);
      if (!doc) throw new EntityNotFoundError('document', id);
      await db.documents.update(id, {
        lastOpenedAt: clock.now(),
        openCount: doc.openCount + 1,
      });
      await logActivity('document.opened', 'document', id);
    });
  },

  toggleFavorite: (doc: LibraryDocument) => base.update(doc.id, { favorite: doc.favorite ? 0 : 1 }),
};
