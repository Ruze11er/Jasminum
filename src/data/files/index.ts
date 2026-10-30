import { db } from '../db';
import type { FileStore } from './FileStore';
import { createIdbFileStore } from './idbFileStore';
import {
  createOpfsFileStore,
  workerWriter,
  writableStreamWriter,
  FILES_DIR,
} from './opfsFileStore';

export type { FileStore } from './FileStore';
export { FileStoreError } from './FileStore';

let storePromise: Promise<FileStore> | null = null;

/**
 * The best available FileStore for this browser, chosen once per session:
 * 1. OPFS with createWritable (most browsers),
 * 2. OPFS through a worker (older Safari),
 * 3. IndexedDB blobs (no OPFS, e.g. some private-browsing modes).
 */
export function getFileStore(): Promise<FileStore> {
  storePromise ??= detectFileStore();
  return storePromise;
}

async function detectFileStore(): Promise<FileStore> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) throw 0;
    const root = await navigator.storage.getDirectory();
    await root.getDirectoryHandle(FILES_DIR, { create: true });
    const hasWritable =
      typeof FileSystemFileHandle !== 'undefined' &&
      'createWritable' in FileSystemFileHandle.prototype;
    if (hasWritable) return createOpfsFileStore(root, writableStreamWriter);
    if (typeof Worker !== 'undefined') return createOpfsFileStore(root, workerWriter);
  } catch {
    // Fall through to IndexedDB.
  }
  return createIdbFileStore(db);
}

/** Test helper. */
export function resetFileStoreForTests() {
  storePromise = null;
}
