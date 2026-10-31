import { clock } from '@/lib/clock';
import { db } from '../db';
import { getFileStore } from '../files';
import { searchIndex } from '../search/searchIndex';
import { TABLE_NAMES, tableOf, type BackupTable } from './format';

/**
 * Small safety copies of all metadata (not file bytes) taken before a restore, so a bad
 * restore can be undone. Stored as JSON in the file store under "snapshot-<time>.json";
 * the newest three are kept. File bytes don't need copying: a restore never deletes any.
 */

export const SNAPSHOT_PREFIX = 'snapshot-';
const KEEP = 3;

export interface SnapshotInfo {
  key: string;
  at: number;
}

interface SnapshotFile {
  reason: string;
  at: number;
  schemaVersion: number;
  tables: Record<BackupTable, unknown[]>;
}

export async function saveSnapshot(reason: string): Promise<string> {
  const tables = {} as Record<BackupTable, unknown[]>;
  await db.transaction('r', TABLE_NAMES.map(tableOf), async () => {
    for (const name of TABLE_NAMES) tables[name] = await tableOf(name).toArray();
  });
  const at = clock.now();
  const snapshot: SnapshotFile = { reason, at, schemaVersion: db.verno, tables };
  const key = `${SNAPSHOT_PREFIX}${at}.json`;
  const store = await getFileStore();
  await store.put(key, new Blob([JSON.stringify(snapshot)], { type: 'application/json' }));
  for (const old of (await listSnapshots()).slice(KEEP)) await store.delete(old.key);
  return key;
}

/** Newest first. */
export async function listSnapshots(): Promise<SnapshotInfo[]> {
  const keys = await (await getFileStore()).keys();
  return keys
    .filter((k) => k.startsWith(SNAPSHOT_PREFIX))
    .map((key) => ({ key, at: Number(key.slice(SNAPSHOT_PREFIX.length).replace('.json', '')) }))
    .filter((s) => Number.isFinite(s.at))
    .sort((a, b) => b.at - a.at);
}

/** Puts every table back exactly as it was in the snapshot. */
export async function restoreSnapshot(key: string): Promise<void> {
  const blob = await (await getFileStore()).get(key);
  if (!blob) throw new Error('That snapshot no longer exists.');
  const snapshot = JSON.parse(await blob.text()) as SnapshotFile;
  await db.transaction('rw', TABLE_NAMES.map(tableOf), async () => {
    for (const name of TABLE_NAMES) {
      await tableOf(name).clear();
      await tableOf(name).bulkPut((snapshot.tables[name] ?? []) as Record<string, unknown>[]);
    }
  });
  await searchIndex.rebuild();
}
