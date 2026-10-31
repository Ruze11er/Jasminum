// @vitest-environment node
// Node has real Blob/File, which the in-memory IndexedDB can store; jsdom's cannot.
import { afterEach, describe, expect, it } from 'vitest';
import { clock } from '@/lib/clock';
import { ValidationError } from '@/lib/validation';
import { db } from '../db';
import { documentsRepo } from '../repos/documents';
import { searchIndex } from '../search/searchIndex';
import { deleteForever, listTrash } from '../trash';
import { sha256OfBlob, storageKeyFor } from './hashing';
import { ImportError, importFile } from './importer';
import { getFileStore } from './index';

const file = (name: string, content: string | Uint8Array, type = '') =>
  new File([content as BlobPart], name, { type });
/** Reference SHA-256 from the platform's own crypto, to check ours against. */
async function sha(s: string | Uint8Array) {
  const bytes = typeof s === 'string' ? new TextEncoder().encode(s) : s;
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

afterEach(() => {
  // Remove any fake storage estimate a test installed.
  delete (navigator as unknown as { storage?: unknown }).storage;
});

describe('hashing', () => {
  it('matches a standard SHA-256, including across many chunks', async () => {
    expect(await sha256OfBlob(new Blob(['abc']))).toBe(await sha('abc'));
    expect(await sha256OfBlob(new Blob([]))).toBe(await sha(''));
    const big = new Uint8Array(9 * 1024 * 1024).map((_, i) => i % 251);
    const progress: number[] = [];
    expect(await sha256OfBlob(new Blob([big]), (d) => progress.push(d))).toBe(await sha(big));
    expect(progress.at(-1)).toBe(big.length);
    expect(progress.length).toBeGreaterThan(1);
  });
});

describe('importing files', () => {
  it('stores the bytes once and creates a document', async () => {
    clock.set(new Date('2026-11-04T10:00:00').getTime());
    const stages: string[] = [];
    const result = await importFile(file('Lecture 3.PDF', '%PDF-1.7 hello', 'application/pdf'), {
      tagIds: ['t1'],
      onProgress: (stage) => stages.push(stage),
    });
    expect(result.status).toBe('added');
    if (result.status !== 'added') return;
    const doc = result.document;
    expect(doc).toMatchObject({
      title: 'Lecture 3',
      originalFilename: 'Lecture 3.PDF',
      ext: 'pdf',
      kind: 'pdf',
      mimeType: 'application/pdf',
      size: 14,
      hash: await sha('%PDF-1.7 hello'),
      storageKey: storageKeyFor(await sha('%PDF-1.7 hello')),
      tagIds: ['t1'],
      openCount: 0,
      addedAt: clock.now(),
    });
    expect(stages).toContain('hashing');
    expect(stages.at(-1)).toBe('saving');
    const stored = await (await getFileStore()).get(doc.storageKey);
    expect(await stored?.text()).toBe('%PDF-1.7 hello');
    expect(searchIndex.search('lecture').map((h) => h.id)).toEqual([doc.id]);
  });

  it('warns about duplicates, and "keep both" shares the stored bytes', async () => {
    const first = await importFile(file('notes.txt', 'same bytes'));
    const again = await importFile(file('copy of notes.txt', 'same bytes'));
    expect(again.status).toBe('duplicate');
    if (again.status !== 'duplicate' || first.status !== 'added') return;
    expect(again.existing.map((d) => d.id)).toEqual([first.document.id]);

    const kept = await importFile(file('copy of notes.txt', 'same bytes'), {
      allowDuplicate: true,
      knownHash: again.hash,
    });
    expect(kept.status).toBe('added');
    expect(await db.documents.count()).toBe(2);
    expect(await (await getFileStore()).keys()).toEqual([storageKeyFor(await sha('same bytes'))]);
  });

  it('refuses a file when there is not enough space', async () => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { estimate: async () => ({ quota: 50 * 1024 * 1024, usage: 40 * 1024 * 1024 }) },
    });
    const err = await importFile(file('big.bin', new Uint8Array(1024))).catch((e) => e);
    expect(err).toBeInstanceOf(ImportError);
    expect(err).toMatchObject({ reason: 'quota' });
    expect(await db.documents.count()).toBe(0);
  });
});

describe('documents', () => {
  it('validates names and descriptions', async () => {
    const r = await importFile(file('a.txt', 'a'));
    if (r.status !== 'added') throw new Error('expected added');
    await expect(documentsRepo.update(r.document.id, { title: ' ' })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      documentsRepo.update(r.document.id, { description: 'x'.repeat(2001) }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('counts opens without changing the edit time', async () => {
    clock.set(1_000_000);
    const r = await importFile(file('a.txt', 'a'));
    if (r.status !== 'added') throw new Error('expected added');
    clock.set(2_000_000);
    await documentsRepo.markOpened(r.document.id);
    await documentsRepo.markOpened(r.document.id);
    expect(await db.documents.get(r.document.id)).toMatchObject({
      openCount: 2,
      lastOpenedAt: 2_000_000,
      updatedAt: 1_000_000,
    });
    expect((await db.activity.toArray()).filter((a) => a.type === 'document.opened')).toHaveLength(
      2,
    );
  });

  it('marks a document as missing when its bytes are gone', async () => {
    const r = await importFile(file('a.txt', 'a'));
    if (r.status !== 'added') throw new Error('expected added');
    await (await getFileStore()).delete(r.document.storageKey);
    expect(await documentsRepo.file(r.document)).toBeNull();
    expect((await db.documents.get(r.document.id))?.fileMissing).toBe(1);
  });

  it('erases bytes only when no other document uses them', async () => {
    const a = await importFile(file('a.txt', 'shared'));
    const b = await importFile(file('b.txt', 'shared'), { allowDuplicate: true });
    if (a.status !== 'added' || b.status !== 'added') throw new Error('expected added');
    const store = await getFileStore();
    const key = a.document.storageKey;

    await documentsRepo.softDelete(a.document.id);
    expect(await listTrash()).toMatchObject([{ type: 'document', label: 'File', title: 'a' }]);
    await deleteForever({ type: 'document', id: a.document.id });
    expect(await store.has(key)).toBe(true); // b still uses it

    await documentsRepo.softDelete(b.document.id);
    await deleteForever({ type: 'document', id: b.document.id });
    expect(await store.has(key)).toBe(false);
  });
});
