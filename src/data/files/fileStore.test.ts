// @vitest-environment node
// Node has real Blob/File, which the in-memory IndexedDB can store; jsdom's cannot.
import { describe, expect, it } from 'vitest';
import { db } from '../db';
import { FileStoreError, toFileStoreError, type FileStore } from './FileStore';
import { createIdbFileStore } from './idbFileStore';
import { createOpfsFileStore } from './opfsFileStore';

/**
 * Minimal in-memory stand-in for the OPFS directory API, enough to exercise the store's
 * logic. Real-browser behavior is covered by the Phase 0 device checks.
 */
function fakeOpfsRoot() {
  const notFound = () => Object.assign(new Error('not found'), { name: 'NotFoundError' });
  const makeDir = (): FileSystemDirectoryHandle => {
    const files = new Map<string, Blob>();
    const dirs = new Map<string, FileSystemDirectoryHandle>();
    const fileHandle = (name: string) =>
      ({
        kind: 'file',
        name,
        getFile: async () => new File([files.get(name)!], name),
        createWritable: async () => {
          let pending: Blob | null = null;
          return {
            write: async (data: Blob) => {
              pending = data;
            },
            close: async () => {
              files.set(name, pending ?? new Blob());
            },
            abort: async () => undefined,
          };
        },
      }) as unknown as FileSystemFileHandle;
    return {
      kind: 'directory',
      getDirectoryHandle: async (name: string, opts?: { create?: boolean }) => {
        if (!dirs.has(name)) {
          if (!opts?.create) throw notFound();
          dirs.set(name, makeDir());
        }
        return dirs.get(name)!;
      },
      getFileHandle: async (name: string, opts?: { create?: boolean }) => {
        if (!files.has(name)) {
          if (!opts?.create) throw notFound();
          files.set(name, new Blob());
        }
        return fileHandle(name);
      },
      removeEntry: async (name: string) => {
        if (!files.delete(name)) throw notFound();
      },
      entries: async function* () {
        for (const name of files.keys()) yield [name, fileHandle(name)];
      },
    } as unknown as FileSystemDirectoryHandle;
  };
  return makeDir();
}

const stores: [string, () => FileStore][] = [
  ['IndexedDB', () => createIdbFileStore(db)],
  ['OPFS', () => createOpfsFileStore(fakeOpfsRoot())],
];

describe.each(stores)('%s FileStore', (_name, make) => {
  it('stores, reads, lists and deletes files', async () => {
    const store = make();
    const bytes = new Uint8Array([1, 2, 3, 250]);
    await store.put('doc-1', new Blob([bytes], { type: 'application/pdf' }));
    await store.put('doc-2', new Blob(['hello']));

    expect(await store.has('doc-1')).toBe(true);
    const blob = await store.get('doc-1');
    expect(new Uint8Array(await blob!.arrayBuffer())).toEqual(bytes);
    expect(await store.keys()).toEqual(['doc-1', 'doc-2']);

    await store.delete('doc-1');
    expect(await store.has('doc-1')).toBe(false);
    expect(await store.get('doc-1')).toBeNull();
    await store.delete('doc-1'); // deleting a missing file is fine
    expect(await store.keys()).toEqual(['doc-2']);
  });

  it('overwrites existing files', async () => {
    const store = make();
    await store.put('a', new Blob(['first']));
    await store.put('a', new Blob(['second']));
    expect(await (await store.get('a'))!.text()).toBe('second');
  });

  it('rejects unsafe keys', async () => {
    const store = make();
    for (const bad of ['', '../x', 'a/b', 'x.partial', '.hidden']) {
      await expect(store.put(bad, new Blob(['x']))).rejects.toThrow(/Invalid file storage key/);
    }
  });
});

describe('toFileStoreError', () => {
  it('turns quota errors into a friendly, typed error', () => {
    const err = toFileStoreError(Object.assign(new Error('x'), { name: 'QuotaExceededError' }));
    expect(err).toBeInstanceOf(FileStoreError);
    expect(err.reason).toBe('quota');
    expect(err.message).toMatch(/Not enough storage/);
  });
});
