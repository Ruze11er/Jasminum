import type { Table } from 'dexie';
import { z, type Schema } from '@/lib/validation';
import { db } from '../db';
import { categorySchema } from '../repos/categories';
import { documentSchema } from '../repos/documents';
import { eventSchema } from '../repos/events';
import { folderSchema } from '../repos/folders';
import { noteSchema } from '../repos/notes';
import { tagSchema } from '../repos/tags';
import { taskSchema } from '../repos/tasks';

/**
 * The backup file: a zip ("<name>.jasminum") holding
 *   manifest.json          what's inside, with checksums
 *   data/<table>.json      every row of every table, including the Trash
 *   files/<storageKey>     file bytes, named by their SHA-256
 * Optionally wrapped in passphrase encryption (see crypto.ts).
 */

export const BACKUP_FORMAT = 'jasminum-backup';
export const BACKUP_VERSION = 1;
export const BACKUP_EXT = 'jasminum';

export class BackupError extends Error {
  constructor(
    message: string,
    readonly reason:
      'not-a-backup' | 'wrong-passphrase' | 'needs-passphrase' | 'damaged' | 'invalid' | 'too-new',
  ) {
    super(message);
    this.name = 'BackupError';
  }
}

// ---------- row schemas ----------

const flag = z.union([z.literal(0), z.literal(1)]);
const base = z.object({
  id: z.string().check(z.minLength(1)),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.nullable(z.number()),
});
/** A stored row = id/timestamps + the repository's own validated fields. */
const entity = <O, I>(fields: Schema<O, I>) => z.intersection(base, fields);

const linkable = z.enum([
  'task',
  'checklistItem',
  'event',
  'note',
  'folder',
  'document',
  'tag',
  'category',
]);

/** Every table that goes into a backup, with how its rows are validated on restore. */
export const BACKUP_TABLES = {
  tasks: entity(taskSchema),
  checklistItems: z.object({
    id: z.string(),
    taskId: z.string(),
    text: z.string().check(z.maxLength(300)),
    done: flag,
    order: z.number(),
    createdAt: z.number(),
    updatedAt: z.number(),
    deletedAt: z.nullable(z.number()),
  }),
  events: entity(eventSchema),
  notes: entity(noteSchema),
  folders: entity(folderSchema),
  documents: entity(documentSchema),
  tags: entity(tagSchema),
  categories: entity(categorySchema),
  links: z.object({
    id: z.string(),
    fromType: linkable,
    fromId: z.string(),
    toType: linkable,
    toId: z.string(),
    createdAt: z.number(),
  }),
  settings: z.object({ key: z.string(), value: z.unknown(), updatedAt: z.number() }),
  activity: z.object({
    id: z.string(),
    at: z.number(),
    type: z.string(),
    entityType: z.string(),
    entityId: z.nullable(z.string()),
    meta: z.optional(z.record(z.string(), z.unknown())),
  }),
  dailyStats: z.looseObject({ date: z.string() }),
  insights: z.looseObject({ id: z.string(), fingerprint: z.string() }),
} satisfies Record<string, Schema>;

export type BackupTable = keyof typeof BACKUP_TABLES;
export const TABLE_NAMES = Object.keys(BACKUP_TABLES) as BackupTable[];

export const tableOf = (name: BackupTable) =>
  db[name] as unknown as Table<Record<string, unknown>, string>;

/** The primary key field of each table. */
export const keyOf = (name: BackupTable) =>
  name === 'settings' ? 'key' : name === 'dailyStats' ? 'date' : 'id';

// ---------- manifest ----------

const sha256Hex = z.string().check(z.regex(/^[0-9a-f]{64}$/));

export const manifestSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  appVersion: z.string(),
  schemaVersion: z.int(),
  createdAt: z.number(),
  counts: z.record(z.string(), z.int()),
  /** SHA-256 of each data/<table>.json, to catch damage. */
  dataChecksums: z.record(z.string(), sha256Hex),
  /** Stored files; each one's name is its SHA-256 (content-addressed). */
  files: z.array(
    z.object({ key: z.string().check(z.regex(/^sha256-[0-9a-f]{64}$/)), size: z.int() }),
  ),
  /** Files a document referred to but this device didn't have when the backup was made. */
  missingFiles: z._default(z.array(z.string()), []),
});

export type Manifest = z.output<typeof manifestSchema>;

export const backupFileName = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `jasminum-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.${BACKUP_EXT}`;
};
