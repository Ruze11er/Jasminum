/**
 * Where file bytes (PDFs, ebooks, images…) live. The database stores only metadata and a
 * `storageKey`. Two implementations exist:
 * - OPFS (Origin Private File System): preferred; built for large files.
 * - IndexedDB blobs: fallback for browsers or modes without OPFS.
 */
export interface FileStore {
  readonly kind: 'opfs' | 'idb';
  put(key: string, data: Blob): Promise<void>;
  /** The stored bytes, or null if missing. */
  get(key: string): Promise<Blob | null>;
  has(key: string): Promise<boolean>;
  /** Deleting a missing key is not an error. */
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

/** Keys become file names, so keep them to a safe character set (UUIDs fit). */
const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function assertValidKey(key: string): void {
  if (!KEY_RE.test(key) || key.endsWith('.partial')) {
    throw new Error(`Invalid file storage key: "${key}"`);
  }
}

export class FileStoreError extends Error {
  constructor(
    message: string,
    readonly reason: 'quota' | 'unavailable' | 'unknown',
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'FileStoreError';
  }
}

/** Turns browser storage errors into a friendly, typed error. */
export function toFileStoreError(err: unknown): FileStoreError {
  if (err instanceof FileStoreError) return err;
  const name = (err as { name?: string })?.name;
  if (name === 'QuotaExceededError') {
    return new FileStoreError('Not enough storage space on this device.', 'quota', { cause: err });
  }
  return new FileStoreError('Could not save the file.', 'unknown', { cause: err });
}
