import { describe, expect, it } from 'vitest';
import type { LibraryDocument } from '@/data/types';
import { DAY_MS } from '@/lib/clock';
import {
  defaultLibraryQuery,
  libraryCounts,
  matchesDocument,
  parseKind,
  parseView,
  selectDocuments,
  type LibraryQuery,
} from './selectors';

const NOW = 1_800_000_000_000;
let seq = 0;
const doc = (title: string, extra: Partial<LibraryDocument> = {}): LibraryDocument => ({
  id: `d${String(++seq).padStart(3, '0')}`,
  title,
  originalFilename: `${title}.pdf`,
  mimeType: 'application/pdf',
  ext: 'pdf',
  kind: 'pdf',
  size: 1000,
  hash: 'a'.repeat(64),
  storageKey: `sha256-${'a'.repeat(64)}`,
  thumbKey: null,
  folderId: null,
  tagIds: [],
  description: '',
  favorite: 0,
  addedAt: NOW - DAY_MS,
  lastOpenedAt: null,
  openCount: 0,
  fileMissing: 0,
  createdAt: 0,
  updatedAt: 0,
  deletedAt: null,
  ...extra,
});

const tagById = new Map([['t-bio', { name: 'biology' }]]);
const ctx = { activeFolderIds: new Set(['f-school']), tagById, now: NOW };
const q = (patch: Partial<LibraryQuery>): LibraryQuery => ({ ...defaultLibraryQuery, ...patch });
const titles = (docs: LibraryDocument[]) => docs.map((d) => d.title);

describe('library views', () => {
  const docs = [
    doc('Cell biology', {
      tagIds: ['t-bio'],
      folderId: 'f-school',
      size: 5000,
      addedAt: NOW - 2 * DAY_MS,
    }),
    doc('Holiday photo', {
      kind: 'image',
      ext: 'jpg',
      originalFilename: 'IMG_2041.jpg',
      favorite: 1,
      size: 300,
    }),
    doc('Old syllabus', {
      addedAt: NOW - 90 * DAY_MS,
      lastOpenedAt: NOW - 1000,
      folderId: 'f-gone',
    }),
    doc('Essay draft', {
      kind: 'word',
      ext: 'docx',
      description: 'History essay on trade routes',
      lastOpenedAt: NOW - 5000,
    }),
    doc('Deleted', { deletedAt: 1 }),
  ];

  it('lists newest first by default and leaves out deleted files', () => {
    expect(titles(selectDocuments(docs, q({}), ctx))).toEqual([
      'Essay draft',
      'Holiday photo',
      'Cell biology',
      'Old syllabus',
    ]);
  });

  it('has smart views for recent, opened, favorites, untagged and unfiled', () => {
    expect(titles(selectDocuments(docs, q({ view: 'recent' }), ctx))).not.toContain('Old syllabus');
    expect(titles(selectDocuments(docs, q({ view: 'opened' }), ctx))).toEqual([
      'Old syllabus',
      'Essay draft',
    ]);
    expect(titles(selectDocuments(docs, q({ view: 'favorites' }), ctx))).toEqual(['Holiday photo']);
    expect(titles(selectDocuments(docs, q({ view: 'untagged' }), ctx))).not.toContain(
      'Cell biology',
    );
    // A file whose folder is in the Trash counts as unfiled.
    expect(titles(selectDocuments(docs, q({ view: 'unfiled' }), ctx))).toContain('Old syllabus');
    expect(titles(selectDocuments(docs, q({ view: 'folder:f-school' }), ctx))).toEqual([
      'Cell biology',
    ]);
  });

  it('filters by type and tag, and sorts by name or size', () => {
    expect(titles(selectDocuments(docs, q({ kind: 'image' }), ctx))).toEqual(['Holiday photo']);
    expect(titles(selectDocuments(docs, q({ tagId: 't-bio' }), ctx))).toEqual(['Cell biology']);
    expect(titles(selectDocuments(docs, q({ sort: 'name' }), ctx))[0]).toBe('Cell biology');
    expect(titles(selectDocuments(docs, q({ sort: 'size' }), ctx))[0]).toBe('Cell biology');
  });

  it('searches names, file names, descriptions and tags', () => {
    expect(titles(selectDocuments(docs, q({ text: 'img_2041' }), ctx))).toEqual(['Holiday photo']);
    expect(titles(selectDocuments(docs, q({ text: 'trade history' }), ctx))).toEqual([
      'Essay draft',
    ]);
    expect(titles(selectDocuments(docs, q({ text: '#biology' }), ctx))).toEqual(['Cell biology']);
    expect(matchesDocument(docs[0]!, 'docx', tagById)).toBe(false);
    expect(matchesDocument(docs[3]!, 'docx', tagById)).toBe(true);
  });

  it('counts files per view, folder and type', () => {
    const c = libraryCounts(docs, ctx);
    expect(c).toMatchObject({
      all: 4,
      recent: 3,
      opened: 2,
      favorites: 1,
      untagged: 3,
      unfiled: 3,
    });
    expect(c.byFolder.get('f-school')).toBe(1);
    expect(c.byKind.get('pdf')).toBe(2);
    expect(c.totalSize).toBe(5000 + 300 + 1000 + 1000);
  });

  it('reads URL values safely', () => {
    expect(parseView('opened')).toBe('opened');
    expect(parseView('folder:x')).toBe('folder:x');
    expect(parseView('nope')).toBe('all');
    expect(parseKind('ebook')).toBe('ebook');
    expect(parseKind('exe')).toBeNull();
  });
});
