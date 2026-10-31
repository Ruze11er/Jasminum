import { strFromU8, Unzip, UnzipInflate, type UnzipFile } from 'fflate';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { db } from '../db';
import { getFileStore } from '../files';
import { searchIndex } from '../search/searchIndex';
import { decryptChunks, isEncrypted } from './crypto';
import {
  BACKUP_TABLES,
  BackupError,
  keyOf,
  manifestSchema,
  TABLE_NAMES,
  tableOf,
  type BackupTable,
  type Manifest,
} from './format';
import { saveSnapshot } from './snapshots';

type Row = Record<string, unknown>;

/** A backup that has been read and fully validated, ready to apply. */
export interface StagedBackup {
  manifest: Manifest;
  tables: Record<BackupTable, Row[]>;
  /** File keys whose bytes are now on this device (verified against their hash). */
  filesStored: Set<string>;
  /** Keys that were in the backup but were damaged, or never in it. */
  filesMissing: string[];
}

export type RestoreMode = 'replace' | 'merge';

async function* plainChunks(file: Blob): AsyncGenerator<Uint8Array> {
  const reader = file.stream().getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    yield value;
  }
}

/** Just enough to show "Backup from Oct 31, 2026 · 42 tasks" before restoring. */
export const needsPassphrase = (file: Blob) => isEncrypted(file);

const describeIssue = (table: string, index: number, err: unknown) => {
  const issue = (err as { issues?: { message: string; path: PropertyKey[] }[] }).issues?.[0];
  const field = issue?.path?.length ? ` (${issue.path.join('.')})` : '';
  return `${table}, item ${index + 1}${field}: ${issue?.message ?? 'invalid'}`;
};

/**
 * Reads a backup file: decrypts it if needed, unzips it as a stream, validates the
 * manifest, every table and every checksum. File bytes are verified and written to the
 * file store as they arrive (they're content-addressed, so this never overwrites
 * anything different). Nothing in the database changes until `applyBackup`.
 */
export async function readBackup(file: Blob, passphrase?: string): Promise<StagedBackup> {
  const encrypted = await isEncrypted(file);
  if (encrypted && !passphrase) {
    throw new BackupError('This backup is protected with a passphrase.', 'needs-passphrase');
  }
  const chunks = encrypted ? decryptChunks(file, passphrase!) : plainChunks(file);

  const store = await getFileStore();
  const texts = new Map<string, string>();
  const filesStored = new Set<string>();
  const damaged: string[] = [];
  const pendingWrites: Promise<void>[] = [];
  let manifest: Manifest | null = null;
  let error: unknown = null;
  let sawEntry = false;

  const onFile = (entry: UnzipFile) => {
    sawEntry = true;
    const name = entry.name;
    const parts: Uint8Array[] = [];
    const isData = name === 'manifest.json' || /^data\/[a-zA-Z]+\.json$/.test(name);
    const fileKey = /^files\/(sha256-[0-9a-f]{64})$/.exec(name)?.[1];
    if (!isData && !fileKey) return; // unknown entries are ignored, never stored
    const hash = fileKey ? sha256.create() : null;
    entry.ondata = (err, data, final) => {
      if (err) {
        error ??= err;
        return;
      }
      parts.push(data);
      hash?.update(data);
      if (!final) return;
      if (isData) {
        texts.set(name, strFromU8(concat(parts)));
        return;
      }
      // A file's name is its SHA-256: anything else is damaged and left out.
      if (`sha256-${bytesToHex(hash!.digest())}` !== fileKey) {
        damaged.push(fileKey!);
        return;
      }
      const blob = new Blob(parts as BlobPart[]);
      pendingWrites.push(
        (async () => {
          if (!(await store.has(fileKey!))) await store.put(fileKey!, blob);
          filesStored.add(fileKey!);
        })(),
      );
    };
    entry.start();
  };

  const unzip = new Unzip(onFile);
  unzip.register(UnzipInflate);
  try {
    for await (const chunk of chunks) {
      unzip.push(chunk, false);
      if (error) break;
      // Validate the manifest and data as soon as they've arrived (they come first).
      if (!manifest && texts.has('manifest.json'))
        manifest = parseManifest(texts.get('manifest.json')!);
      if (pendingWrites.length > 8) await Promise.all(pendingWrites.splice(0));
    }
    if (!error) unzip.push(new Uint8Array(0), true);
    await Promise.all(pendingWrites);
  } catch (err) {
    if (err instanceof BackupError) throw err;
    throw new BackupError('This file is not a Jasminum backup, or it is damaged.', 'not-a-backup');
  }
  if (error || !sawEntry) {
    throw new BackupError('This file is not a Jasminum backup, or it is damaged.', 'not-a-backup');
  }

  manifest ??= parseManifest(texts.get('manifest.json'));
  if (manifest.schemaVersion > db.verno) {
    throw new BackupError(
      'This backup was made by a newer version of Jasminum. Update the app, then try again.',
      'too-new',
    );
  }

  const tables = {} as Record<BackupTable, Row[]>;
  for (const name of TABLE_NAMES) {
    const text = texts.get(`data/${name}.json`);
    if (text === undefined) {
      tables[name] = [];
      continue;
    }
    const expected = manifest.dataChecksums[name];
    if (expected && bytesToHex(sha256(new TextEncoder().encode(text))) !== expected) {
      throw new BackupError(`The backup's ${name} data is damaged.`, 'damaged');
    }
    let rows: unknown;
    try {
      rows = JSON.parse(text);
    } catch {
      throw new BackupError(`The backup's ${name} data is damaged.`, 'damaged');
    }
    if (!Array.isArray(rows))
      throw new BackupError(`The backup's ${name} data is damaged.`, 'damaged');
    const schema = BACKUP_TABLES[name];
    tables[name] = rows.map((row, i) => {
      const result = schema.safeParse(row);
      if (!result.success) {
        throw new BackupError(`Can't restore: ${describeIssue(name, i, result.error)}`, 'invalid');
      }
      return result.data as Row;
    });
  }

  const referenced = new Set(tables.documents.map((d) => d.storageKey as string));
  const filesMissing = [...referenced].filter((k) => !filesStored.has(k) && !damaged.includes(k));
  return {
    manifest,
    tables,
    filesStored,
    filesMissing: [...new Set([...damaged, ...filesMissing])],
  };
}

function parseManifest(text: string | undefined): Manifest {
  if (text === undefined) {
    throw new BackupError('This file is not a Jasminum backup, or it is damaged.', 'not-a-backup');
  }
  try {
    return manifestSchema.parse(JSON.parse(text));
  } catch {
    throw new BackupError('This file is not a Jasminum backup, or it is damaged.', 'not-a-backup');
  }
}

function concat(parts: Uint8Array[]) {
  if (parts.length === 1) return parts[0]!;
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

export interface RestoreResult {
  counts: Record<string, number>;
  filesMissing: number;
  snapshotKey: string;
}

/**
 * Applies a staged backup in one transaction, after saving a snapshot of the current
 * data (for "Undo restore").
 * - replace: the device ends up with exactly the backup's data.
 * - merge: rows not on this device are added; rows on both keep the newer `updatedAt`.
 * Documents whose bytes aren't on this device are flagged `fileMissing`.
 */
export async function applyBackup(staged: StagedBackup, mode: RestoreMode): Promise<RestoreResult> {
  const snapshotKey = await saveSnapshot('before-restore');
  const tables = mode === 'merge' ? await remapMergedTags(staged.tables) : staged.tables;
  const counts: Record<string, number> = {};

  await db.transaction('rw', TABLE_NAMES.map(tableOf), async () => {
    for (const name of TABLE_NAMES) {
      const table = tableOf(name);
      const rows = tables[name];
      if (mode === 'replace') {
        await table.clear();
        await table.bulkPut(rows);
        counts[name] = rows.length;
        continue;
      }
      const key = keyOf(name);
      let applied = 0;
      for (const row of rows) {
        const existing = await table.get(row[key] as string);
        const newer =
          !existing ||
          (typeof row.updatedAt === 'number' &&
            typeof existing.updatedAt === 'number' &&
            row.updatedAt > existing.updatedAt);
        if (!newer) continue;
        // Unique fingerprints (insights) can't be duplicated under another id.
        if (name === 'insights' && !existing) {
          const clash = await db.insights
            .where('fingerprint')
            .equals(row.fingerprint as string)
            .count();
          if (clash) continue;
        }
        await table.put(row);
        applied++;
      }
      counts[name] = applied;
    }
  });

  await refreshFileFlags();
  await searchIndex.rebuild();
  return { counts, filesMissing: staged.filesMissing.length, snapshotKey };
}

/**
 * Two devices can each have a tag "biology" with different ids, but tag names are
 * unique. When merging, the backup's tag is mapped onto the one already here, and the
 * backup's items point to it instead.
 */
async function remapMergedTags(tables: Record<BackupTable, Row[]>) {
  const map = new Map<string, string>();
  const tags: Row[] = [];
  for (const tag of tables.tags) {
    const existing = await db.tags
      .where('normalizedName')
      .equals(tag.normalizedName as string)
      .first();
    if (existing && existing.id !== tag.id) map.set(tag.id as string, existing.id);
    else tags.push(tag);
  }
  if (!map.size) return tables;
  const remap = (rows: Row[]) =>
    rows.map((r) =>
      Array.isArray(r.tagIds)
        ? { ...r, tagIds: [...new Set((r.tagIds as string[]).map((id) => map.get(id) ?? id))] }
        : r,
    );
  return {
    ...tables,
    tags,
    tasks: remap(tables.tasks),
    events: remap(tables.events),
    notes: remap(tables.notes),
    documents: remap(tables.documents),
  };
}

/** Sets `fileMissing` on every document to match what's actually in the file store. */
export async function refreshFileFlags() {
  const store = await getFileStore();
  const docs = await db.documents.toArray();
  for (const d of docs) {
    const missing = (await store.has(d.storageKey)) ? 0 : 1;
    if (d.fileMissing !== missing) await db.documents.update(d.id, { fileMissing: missing });
  }
}

/** Removes bytes written while reading a backup that was then not applied. */
export async function discardStaged(staged: StagedBackup) {
  const store = await getFileStore();
  const used = new Set((await db.documents.toArray()).map((d) => d.storageKey));
  for (const key of staged.filesStored) if (!used.has(key)) await store.delete(key);
}
