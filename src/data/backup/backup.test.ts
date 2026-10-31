// @vitest-environment node
// Node has real Blob/File streams, which backups and the file store need.
import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { clock, DAY_MS } from '@/lib/clock';
import { db } from '../db';
import { importFile } from '../files/importer';
import { getFileStore } from '../files';
import { checkIntegrity, fixIntegrity, isClean } from '../integrity';
import { categoriesRepo } from '../repos/categories';
import { eventsRepo } from '../repos/events';
import { foldersRepo } from '../repos/folders';
import { linksRepo } from '../repos/links';
import { notesRepo } from '../repos/notes';
import { getSetting, setSetting } from '../repos/settings';
import { tagsRepo } from '../repos/tags';
import { tasksRepo } from '../repos/tasks';
import { searchIndex } from '../search/searchIndex';
import { createEncryptor, decryptChunks } from './crypto';
import { createBackupBlob } from './exportBackup';
import { BackupError, TABLE_NAMES, keyOf, tableOf } from './format';
import { applyBackup, readBackup } from './restore';
import { listSnapshots, pruneSnapshots, restoreSnapshot, saveSnapshot } from './snapshots';
import { eraseAllData } from '../eraseAll';
import { deleteForever, emptyTrash, purgeExpiredTrash } from '../trash';

const FAST = 1000; // PBKDF2 rounds for tests (real backups use 600,000)

/** Byte-by-byte check. (toEqual on megabytes of data is very slow.) */
const sameBytes = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

async function dump() {
  const out: Record<string, unknown[]> = {};
  for (const name of TABLE_NAMES) {
    const key = keyOf(name);
    out[name] = (await tableOf(name).toArray()).sort((a, b) =>
      String(a[key]).localeCompare(String(b[key])),
    );
  }
  return out;
}

async function storedFiles() {
  const store = await getFileStore();
  const out: Record<string, string> = {};
  for (const key of await store.keys()) {
    if (key.startsWith('sha256-')) out[key] = await (await store.get(key))!.text();
  }
  return out;
}

/** Erases everything on "this device": every table and every stored file. */
async function wipe() {
  await db.transaction('rw', TABLE_NAMES.map(tableOf), async () => {
    for (const name of TABLE_NAMES) await tableOf(name).clear();
  });
  const store = await getFileStore();
  for (const key of await store.keys()) await store.delete(key);
}

async function seed() {
  clock.set(new Date('2026-11-04T10:00:00').getTime());
  const bio = await tagsRepo.ensure('biology');
  const school = await categoriesRepo.create({ name: 'School', color: 'lavender' });
  const task = await tasksRepo.create({
    title: 'Lab report',
    dueDate: '2026-11-05',
    categoryId: school.id,
    tagIds: [bio.id],
  });
  await tasksRepo.saveChecklist(task.id, [{ text: 'Graphs', done: true }]);
  await eventsRepo.create({ title: 'Exam', allDay: 1, start: '2026-11-20', end: '2026-11-20' });
  const folder = await foldersRepo.add('notes', 'Lectures');
  const note = await notesRepo.create({
    title: 'Cells',
    folderId: folder.id,
    contentText: 'Mitochondria',
    contentJson: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Mitochondria' }] }],
    },
  });
  const imported = await importFile(
    new File(['%PDF-1.7 lecture'], 'Lecture.pdf', { type: 'application/pdf' }),
  );
  if (imported.status !== 'added') throw new Error('import failed');
  await linksRepo.link(
    { type: 'note', id: note.id },
    { type: 'document', id: imported.document.id },
  );
  const trashed = await tasksRepo.create({ title: 'Old idea' });
  await tasksRepo.softDelete(trashed.id);
  await setSetting('profile', { displayName: 'Jas' });
  return { task, note, doc: imported.document };
}

describe('backup encryption', () => {
  const encrypt = async (data: Uint8Array, passphrase: string) => {
    const parts: Uint8Array[] = [];
    const enc = await createEncryptor(passphrase, (c) => void parts.push(c), FAST);
    // Write in uneven pieces to exercise chunking.
    for (let i = 0; i < data.length; i += 700_000) await enc.write(data.slice(i, i + 700_000));
    await enc.finish();
    return new Blob(parts as BlobPart[]);
  };
  const decrypt = async (blob: Blob, passphrase: string) => {
    const parts: Uint8Array[] = [];
    for await (const c of decryptChunks(blob, passphrase)) parts.push(c);
    return new Uint8Array(await new Blob(parts as BlobPart[]).arrayBuffer());
  };
  const data = new Uint8Array(2.5 * 1024 * 1024).map((_, i) => (i * 31) % 256);

  it('round-trips data across several chunks', async () => {
    const blob = await encrypt(data, 'correct horse');
    expect(sameBytes(await decrypt(blob, 'correct horse'), data)).toBe(true);
    expect(await decrypt(await encrypt(new Uint8Array(0), 'x'), 'x')).toEqual(new Uint8Array(0));
  });

  it('rejects a wrong passphrase, a cut-off file and tampering', async () => {
    const blob = await encrypt(data, 'correct horse');
    await expect(decrypt(blob, 'wrong')).rejects.toMatchObject({ reason: 'wrong-passphrase' });
    const cut = blob.slice(0, blob.size - 1000);
    await expect(decrypt(cut, 'correct horse')).rejects.toMatchObject({ reason: 'damaged' });
    // Dropping the whole last chunk is caught too: the new last chunk wasn't marked final.
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const tampered = bytes.slice();
    tampered[tampered.length - 20]! ^= 1;
    await expect(decrypt(new Blob([tampered]), 'correct horse')).rejects.toMatchObject({
      reason: 'damaged',
    });
  });
});

describe('backup and restore', () => {
  it('export → wipe → restore gives identical data and files', async () => {
    await seed();
    const before = await dump();
    const filesBefore = await storedFiles();

    const { blob, summary } = await createBackupBlob();
    expect(summary).toMatchObject({ files: 1, missingFiles: 0 });
    expect(summary.counts).toMatchObject({ tasks: 2, notes: 1, documents: 1, links: 1 });
    expect(await getSetting('lastBackupAt')).toBe(clock.now());

    await wipe();
    expect(await db.tasks.count()).toBe(0);

    const staged = await readBackup(blob);
    expect(staged.manifest.counts.tasks).toBe(2);
    await applyBackup(staged, 'replace');

    expect(await dump()).toEqual(before);
    expect(await storedFiles()).toEqual(filesBefore);
    expect(searchIndex.search('mitochondria').map((h) => h.type)).toEqual(['note']);
  });

  it('protects a backup with a passphrase', async () => {
    await seed();
    const before = await dump();
    const { blob } = await createBackupBlob({ passphrase: 'pink jasmine', iterations: FAST });
    expect(await blob.text()).not.toContain('Lab report');
    await wipe();
    await expect(readBackup(blob)).rejects.toMatchObject({ reason: 'needs-passphrase' });
    await expect(readBackup(blob, 'nope')).rejects.toMatchObject({ reason: 'wrong-passphrase' });
    await applyBackup(await readBackup(blob, 'pink jasmine'), 'replace');
    expect(await dump()).toEqual(before);
  });

  it('merges: adds what is missing and keeps the newer copy of each item', async () => {
    const { task, note } = await seed();
    const { blob } = await createBackupBlob();

    // After the backup: rename the task here (newer), delete the note, add a new task.
    clock.set(clock.now() + 60_000);
    await tasksRepo.update(task.id, { title: 'Lab report (final)' });
    await notesRepo.softDelete(note.id);
    await notesRepo.purge(note.id);
    const fresh = await tasksRepo.create({ title: 'Only on this device' });

    await applyBackup(await readBackup(blob), 'merge');
    expect((await db.tasks.get(task.id))?.title).toBe('Lab report (final)');
    expect((await db.notes.get(note.id))?.title).toBe('Cells');
    expect(await db.tasks.get(fresh.id)).toBeDefined();
  });

  it('maps a same-named tag onto the one already here when merging', async () => {
    const { task } = await seed();
    const { blob } = await createBackupBlob();
    await wipe();
    const local = await tagsRepo.ensure('Biology');
    await applyBackup(await readBackup(blob), 'merge');
    expect(await db.tags.count()).toBe(1);
    expect((await db.tasks.get(task.id))?.tagIds).toEqual([local.id]);
  });

  it('refuses files that are not backups, damaged data, invalid rows and newer formats', async () => {
    await expect(readBackup(new Blob(['hello']))).rejects.toMatchObject({ reason: 'not-a-backup' });

    await seed();
    const { blob } = await createBackupBlob();
    const staged = await readBackup(blob);
    const make = (
      patch: (files: Record<string, Uint8Array>, m: typeof staged.manifest) => void,
    ) => {
      // Rebuilt rows differ byte-for-byte from the original JSON, so start without checksums.
      const manifest = {
        ...structuredClone(staged.manifest),
        dataChecksums: {} as Record<string, string>,
      };
      const files: Record<string, Uint8Array> = {};
      for (const name of TABLE_NAMES)
        files[`data/${name}.json`] = strToU8(JSON.stringify(staged.tables[name]));
      patch(files, manifest);
      files['manifest.json'] = strToU8(JSON.stringify(manifest));
      return new Blob([zipSync(files)]);
    };

    // Changed data that no longer matches its checksum.
    const damaged = make((f, m) => {
      f['data/tasks.json'] = strToU8('[]');
      m.dataChecksums.tasks = staged.manifest.dataChecksums.tasks!;
    });
    await expect(readBackup(damaged)).rejects.toMatchObject({ reason: 'damaged' });

    // A row that breaks the rules (no checksum, so validation is what catches it).
    const invalid = make((f) => {
      f['data/tasks.json'] = strToU8(
        JSON.stringify([{ ...staged.tables.tasks[0], dueDate: '2026-02-30' }]),
      );
    });
    const err = await readBackup(invalid).catch((e) => e);
    expect(err).toBeInstanceOf(BackupError);
    expect(err).toMatchObject({ reason: 'invalid' });
    expect((err as Error).message).toContain('tasks, item 1');

    const tooNew = make((_, m) => (m.schemaVersion = 99));
    await expect(readBackup(tooNew)).rejects.toMatchObject({ reason: 'too-new' });
  });

  it('restores everything else when a file inside the backup is damaged', async () => {
    const { doc } = await seed();
    const { blob } = await createBackupBlob();
    const staged = await readBackup(blob);
    const files: Record<string, Uint8Array> = {
      'manifest.json': strToU8(JSON.stringify({ ...staged.manifest, dataChecksums: {} })),
      [`files/${doc.storageKey}`]: strToU8('not the original bytes'),
    };
    for (const name of TABLE_NAMES)
      files[`data/${name}.json`] = strToU8(JSON.stringify(staged.tables[name]));
    await wipe();

    const broken = await readBackup(new Blob([zipSync(files)]));
    expect(broken.filesMissing).toEqual([doc.storageKey]);
    const result = await applyBackup(broken, 'replace');
    expect(result.filesMissing).toBe(1);
    expect((await db.documents.get(doc.id))?.fileMissing).toBe(1);
    expect(await db.tasks.count()).toBe(2);
  });
});

describe('snapshots', () => {
  it('saves one before each restore, and can undo the restore', async () => {
    await seed();
    const { blob } = await createBackupBlob();
    await tasksRepo.create({ title: 'Made after the backup' });
    const before = await dump();

    const result = await applyBackup(await readBackup(blob), 'replace');
    expect(await db.tasks.filter((t) => t.title === 'Made after the backup').count()).toBe(0);
    await restoreSnapshot(result.snapshotKey);
    expect(await dump()).toEqual(before);
  });

  it('keeps only the newest three', async () => {
    for (let i = 1; i <= 5; i++) {
      clock.set(i * 1000);
      await saveSnapshot('test');
    }
    expect((await listSnapshots()).map((s) => s.at)).toEqual([5000, 4000, 3000]);
  });

  it('expire after a week', async () => {
    clock.set(1 * DAY_MS);
    await saveSnapshot('old');
    clock.set(5 * DAY_MS);
    await saveSnapshot('recent');
    expect(await pruneSnapshots(8 * DAY_MS)).toBe(1);
    expect((await listSnapshots()).map((s) => s.at)).toEqual([5 * DAY_MS]);
  });

  it('are erased when something is deleted for good, so it leaves no copy behind', async () => {
    const tag = await tagsRepo.ensure('Secret');
    await tagsRepo.softDelete(tag.id);
    await saveSnapshot('test');
    await deleteForever({ type: 'tag', id: tag.id });
    expect(await listSnapshots()).toEqual([]);

    const other = await tagsRepo.ensure('Also secret');
    await tagsRepo.softDelete(other.id);
    await saveSnapshot('test');
    await emptyTrash();
    expect(await listSnapshots()).toEqual([]);
  });

  it('are kept when the Trash expires on its own (they expire within a week anyway)', async () => {
    const tag = await tagsRepo.ensure('Old');
    clock.set(DAY_MS);
    await tagsRepo.softDelete(tag.id);
    clock.set(40 * DAY_MS);
    await saveSnapshot('test');
    expect(await purgeExpiredTrash()).toBe(1);
    expect(await listSnapshots()).toHaveLength(1);
  });
});

describe('delete everything', () => {
  it('erases the database, stored files and snapshots', async () => {
    const { doc } = await seed();
    await saveSnapshot('test');
    const store = await getFileStore();
    expect(await store.has(doc.storageKey)).toBe(true);

    await eraseAllData();
    await db.open();
    for (const name of TABLE_NAMES) expect(await tableOf(name).count()).toBe(0);
    // Node has no OPFS, so files live in the database's fallback table, erased with it.
    expect(store.kind).toBe('idb');
    expect(await store.keys()).toEqual([]);
  });
});

describe('integrity check', () => {
  it('finds and fixes orphan files, missing files, dangling links and stray checklist items', async () => {
    const { doc, note } = await seed();
    expect(isClean(await checkIntegrity())).toBe(true);

    const store = await getFileStore();
    const orphanKey = `sha256-${'f'.repeat(64)}`;
    await store.put(orphanKey, new Blob(['leftover']));
    await saveSnapshot('test'); // snapshots are not orphans
    await store.delete(doc.storageKey);
    await db.links.add({
      id: 'l1',
      fromType: 'note',
      fromId: note.id,
      toType: 'task',
      toId: 'gone',
      createdAt: 0,
    });
    await db.checklistItems.add({
      id: 'c1',
      taskId: 'gone',
      text: 'x',
      done: 0,
      order: 0,
      createdAt: 0,
      updatedAt: 0,
      deletedAt: null,
    });

    const report = await checkIntegrity();
    expect(report.orphanFiles).toEqual([{ key: orphanKey, size: 8 }]);
    expect(report.missingFiles.map((d) => d.id)).toEqual([doc.id]);
    expect(report.danglingLinks.map((l) => l.id)).toEqual(['l1']);
    expect(report.orphanChecklistItems.map((i) => i.id)).toEqual(['c1']);

    const fixed = await fixIntegrity(report);
    expect(fixed).toEqual({
      removedFiles: 1,
      freedBytes: 8,
      flaggedMissing: 1,
      removedLinks: 1,
      removedChecklistItems: 1,
    });
    expect(await store.has(orphanKey)).toBe(false);
    expect((await db.documents.get(doc.id))?.fileMissing).toBe(1);
    const after = await checkIntegrity();
    expect(after.orphanFiles).toEqual([]);
    expect(after.danglingLinks).toEqual([]);
  });
});
