import { clock } from '@/lib/clock';
import { baseName, extensionOf, kindOf } from '@/lib/fileKinds';
import { hasRoomFor } from '@/platform/storage';
import { db } from '../db';
import { documentsRepo } from '../repos/documents';
import type { LibraryDocument } from '../types';
import { FileStoreError } from './FileStore';
import { hashFile, storageKeyFor } from './hashing';
import { getFileStore } from './index';

/** Files bigger than this are refused up front (the plan targets up to ~200 MB). */
export const MAX_FILE_SIZE = 2 * 1024 ** 3;

export type ImportStage = 'hashing' | 'saving';

export interface ImportOptions {
  folderId?: string | null;
  tagIds?: string[];
  /** Import even if the same content is already in the library ("Keep both"). */
  allowDuplicate?: boolean;
  /** Skip hashing when the hash is already known (e.g. after a duplicate warning). */
  knownHash?: string;
  /** 0–1 while hashing; `saving` has no fraction (the browser copies the bytes). */
  onProgress?: (stage: ImportStage, fraction: number | null) => void;
}

export type ImportResult =
  | { status: 'added'; document: LibraryDocument }
  | { status: 'duplicate'; hash: string; existing: LibraryDocument[] };

export class ImportError extends Error {
  constructor(
    message: string,
    readonly reason: 'quota' | 'too-large' | 'unknown',
  ) {
    super(message);
    this.name = 'ImportError';
  }
}

/**
 * Adds one file to the library: checks free space, hashes it (in a worker), stops at
 * duplicates unless asked not to, stores the bytes once per content and creates the
 * document record.
 */
export async function importFile(file: File, opts: ImportOptions = {}): Promise<ImportResult> {
  if (file.size > MAX_FILE_SIZE) {
    throw new ImportError('This file is too big (the limit is 2 GB).', 'too-large');
  }
  if (!(await hasRoomFor(file.size))) {
    throw new ImportError('Not enough storage space on this device.', 'quota');
  }

  const hash =
    opts.knownHash ??
    (await hashFile(file, (done) =>
      opts.onProgress?.('hashing', file.size ? done / file.size : 1),
    ));

  if (!opts.allowDuplicate) {
    const existing = await documentsRepo.findByHash(hash);
    if (existing.length) return { status: 'duplicate', hash, existing };
  }

  opts.onProgress?.('saving', null);
  const store = await getFileStore();
  const storageKey = storageKeyFor(hash);
  let wroteBytes = false;
  try {
    if (!(await store.has(storageKey))) {
      await store.put(storageKey, file);
      wroteBytes = true;
    }
  } catch (err) {
    if (err instanceof FileStoreError && err.reason === 'quota') {
      throw new ImportError('Not enough storage space on this device.', 'quota');
    }
    throw new ImportError("Couldn't save the file.", 'unknown');
  }

  try {
    const document = await documentsRepo.create({
      title: baseName(file.name).slice(0, 200),
      originalFilename: file.name.slice(0, 255),
      mimeType: file.type.slice(0, 255),
      ext: extensionOf(file.name),
      kind: kindOf(file.name, file.type),
      size: file.size,
      hash,
      storageKey,
      folderId: opts.folderId ?? null,
      tagIds: opts.tagIds ?? [],
      addedAt: clock.now(),
    });
    return { status: 'added', document };
  } catch (err) {
    // Don't leave unreferenced bytes behind if the record couldn't be saved.
    if (wroteBytes && !(await db.documents.filter((d) => d.storageKey === storageKey).count())) {
      await store.delete(storageKey).catch(() => undefined);
    }
    const quota = (err as { name?: string })?.name === 'QuotaExceededError';
    throw new ImportError(
      quota ? 'Not enough storage space on this device.' : "Couldn't save the file.",
      quota ? 'quota' : 'unknown',
    );
  }
}
