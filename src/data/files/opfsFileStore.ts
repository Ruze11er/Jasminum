import { assertValidKey, toFileStoreError, type FileStore } from './FileStore';

export const FILES_DIR = 'files';

/** Writes a blob into an OPFS file. Swappable so Safari can use a worker instead. */
export type OpfsWriter = (
  dir: FileSystemDirectoryHandle,
  name: string,
  data: Blob,
) => Promise<void>;

/**
 * Main-thread writer using `createWritable()` (Chrome, Edge, Firefox, recent Safari).
 * The browser writes to a temporary swap file and only replaces the target on close(),
 * so a failed write never leaves a half-written file behind.
 */
export const writableStreamWriter: OpfsWriter = async (dir, name, data) => {
  const handle = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  try {
    await writable.write(data);
    await writable.close();
  } catch (err) {
    await writable.abort().catch(() => undefined);
    throw err;
  }
};

/**
 * Worker writer using `createSyncAccessHandle()`, which older Safari versions support
 * even without `createWritable()`. Writes to "<key>.partial" and renames by copying on
 * success, so readers never see a partial file.
 */
export const workerWriter: OpfsWriter = (_dir, name, data) =>
  new Promise<void>((resolve, reject) => {
    const worker = new Worker(new URL('./opfsWrite.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<{ ok: boolean; error?: string; errorName?: string }>) => {
      worker.terminate();
      if (e.data.ok) resolve();
      else reject(Object.assign(new Error(e.data.error), { name: e.data.errorName }));
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message));
    };
    worker.postMessage({ dir: FILES_DIR, name, data });
  });

export function createOpfsFileStore(
  root: FileSystemDirectoryHandle,
  writer: OpfsWriter = writableStreamWriter,
): FileStore {
  const dir = () => root.getDirectoryHandle(FILES_DIR, { create: true });

  const fileHandle = async (key: string) => {
    try {
      return await (await dir()).getFileHandle(key);
    } catch (err) {
      if ((err as { name?: string }).name === 'NotFoundError') return null;
      throw err;
    }
  };

  return {
    kind: 'opfs',

    async put(key, data) {
      assertValidKey(key);
      try {
        await writer(await dir(), key, data);
      } catch (err) {
        throw toFileStoreError(err);
      }
    },

    async get(key) {
      assertValidKey(key);
      const handle = await fileHandle(key);
      return handle ? handle.getFile() : null;
    },

    async has(key) {
      assertValidKey(key);
      return (await fileHandle(key)) !== null;
    },

    async delete(key) {
      assertValidKey(key);
      try {
        await (await dir()).removeEntry(key);
      } catch (err) {
        if ((err as { name?: string }).name !== 'NotFoundError') throw err;
      }
    },

    async keys() {
      const out: string[] = [];
      for await (const [name, handle] of (await dir()).entries()) {
        if (handle.kind === 'file' && !name.endsWith('.partial')) out.push(name);
      }
      return out.sort();
    },
  };
}
