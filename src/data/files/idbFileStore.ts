import { clock } from '@/lib/clock';
import type { JasminumDB } from '../db';
import { assertValidKey, toFileStoreError, type FileStore } from './FileStore';

/** Fallback store: file bytes as Blobs in the `fileBlobs` IndexedDB table. */
export function createIdbFileStore(database: JasminumDB): FileStore {
  return {
    kind: 'idb',

    async put(key, data) {
      assertValidKey(key);
      try {
        await database.fileBlobs.put({ key, blob: data, size: data.size, updatedAt: clock.now() });
      } catch (err) {
        throw toFileStoreError(err);
      }
    },

    async get(key) {
      assertValidKey(key);
      return (await database.fileBlobs.get(key))?.blob ?? null;
    },

    async has(key) {
      assertValidKey(key);
      return (await database.fileBlobs.where('key').equals(key).count()) > 0;
    },

    async delete(key) {
      assertValidKey(key);
      await database.fileBlobs.delete(key);
    },

    keys: () => database.fileBlobs.toCollection().primaryKeys(),
  };
}
