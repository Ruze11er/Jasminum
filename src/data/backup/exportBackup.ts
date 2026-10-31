import { strToU8, Zip, ZipDeflate, ZipPassThrough } from 'fflate';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { clock } from '@/lib/clock';
import { db } from '../db';
import { getFileStore } from '../files';
import { setSetting } from '../repos/settings';
import { createEncryptor } from './crypto';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  TABLE_NAMES,
  tableOf,
  type BackupTable,
  type Manifest,
} from './format';

export type ByteSink = (chunk: Uint8Array) => void | Promise<void>;

export interface BackupOptions {
  /** Encrypt the backup with this passphrase. */
  passphrase?: string;
  /** For tests: fewer PBKDF2 rounds. */
  iterations?: number;
  /** Bytes of file data written so far, out of the total. */
  onProgress?: (done: number, total: number) => void;
}

export interface BackupSummary {
  counts: Record<string, number>;
  files: number;
  missingFiles: number;
  bytes: number;
}

/**
 * Writes a complete backup to `sink`: every table (Trash included) and every stored
 * file once. Files are streamed in chunks; nothing is compressed twice (file bytes are
 * stored as-is, the JSON is deflated).
 */
export async function writeBackup(
  sink: ByteSink,
  opts: BackupOptions = {},
): Promise<BackupSummary> {
  // 1. Read all metadata at one moment, so the backup is consistent.
  const data = {} as Record<BackupTable, unknown[]>;
  await db.transaction('r', TABLE_NAMES.map(tableOf), async () => {
    for (const name of TABLE_NAMES) data[name] = await tableOf(name).toArray();
  });

  const store = await getFileStore();
  const keys = [
    ...new Set((data.documents as { storageKey: string }[]).map((d) => d.storageKey)),
  ].sort();
  const files: { key: string; blob: Blob }[] = [];
  const missingFiles: string[] = [];
  for (const key of keys) {
    const blob = await store.get(key);
    if (blob) files.push({ key, blob });
    else missingFiles.push(key);
  }

  const json = Object.fromEntries(
    TABLE_NAMES.map((name) => [name, strToU8(JSON.stringify(data[name]))]),
  ) as Record<BackupTable, Uint8Array>;
  const manifest: Manifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    appVersion: __APP_VERSION__,
    schemaVersion: db.verno,
    createdAt: clock.now(),
    counts: Object.fromEntries(TABLE_NAMES.map((n) => [n, data[n].length])),
    dataChecksums: Object.fromEntries(TABLE_NAMES.map((n) => [n, bytesToHex(sha256(json[n]))])),
    files: files.map((f) => ({ key: f.key, size: f.blob.size })),
    missingFiles,
  };

  // 2. Optional encryption sits between the zip and the sink.
  const encryptor = opts.passphrase
    ? await createEncryptor(opts.passphrase, sink, opts.iterations)
    : null;
  const out: ByteSink = encryptor ? (c) => encryptor.write(c) : sink;

  // fflate calls back synchronously; queue the writes and wait for them between files
  // so a slow disk applies back-pressure instead of filling memory.
  let queue: Promise<void> = Promise.resolve();
  let failed: unknown = null;
  let bytes = 0;
  let done!: () => void;
  const finished = new Promise<void>((resolve) => (done = resolve));
  const zip = new Zip((err, chunk, final) => {
    if (err) failed = err;
    bytes += chunk.length;
    queue = queue.then(() => out(chunk));
    if (final) void queue.then(done, done);
  });
  const drain = async () => {
    await queue;
    if (failed) throw failed;
  };

  const addDeflated = (name: string, bytesIn: Uint8Array) => {
    const entry = new ZipDeflate(name, { level: 6 });
    zip.add(entry);
    entry.push(bytesIn, true);
  };

  addDeflated('manifest.json', strToU8(JSON.stringify(manifest, null, 2)));
  for (const name of TABLE_NAMES) addDeflated(`data/${name}.json`, json[name]);
  await drain();

  const total = files.reduce((n, f) => n + f.blob.size, 0);
  let written = 0;
  opts.onProgress?.(0, total);
  for (const { key, blob } of files) {
    const entry = new ZipPassThrough(`files/${key}`);
    zip.add(entry);
    const reader = blob.stream().getReader();
    for (;;) {
      const { done: end, value } = await reader.read();
      if (end) break;
      entry.push(value, false);
      written += value.length;
      await drain();
      opts.onProgress?.(written, total);
    }
    entry.push(new Uint8Array(0), true);
    await drain();
  }
  zip.end();
  await finished;
  await drain();
  if (encryptor) await encryptor.finish();

  await setSetting('lastBackupAt', clock.now());
  return {
    counts: manifest.counts,
    files: files.length,
    missingFiles: missingFiles.length,
    bytes,
  };
}

/** The whole backup as one Blob (for Download or Share). */
export async function createBackupBlob(opts: BackupOptions = {}) {
  const parts: Uint8Array[] = [];
  const summary = await writeBackup((c) => void parts.push(c), opts);
  return { blob: new Blob(parts as BlobPart[], { type: 'application/octet-stream' }), summary };
}
