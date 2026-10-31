import { describe, expect, it } from 'vitest';
import type { Note } from '@/data/types';
import {
  defaultNoteQuery,
  matchesText,
  parseScope,
  scopeCounts,
  selectNotes,
  snippet,
  type NoteQuery,
} from './selectors';

let seq = 0;
const note = (title: string, extra: Partial<Note> = {}): Note => ({
  id: `n${String(++seq).padStart(3, '0')}`,
  title,
  contentJson: null,
  contentText: '',
  folderId: null,
  tagIds: [],
  pinned: 0,
  favorite: 0,
  createdAt: seq,
  updatedAt: seq,
  deletedAt: null,
  ...extra,
});

const q = (patch: Partial<NoteQuery>): NoteQuery => ({ ...defaultNoteQuery, ...patch });
const titles = (notes: Note[]) => notes.map((n) => n.title);

describe('note list', () => {
  const school = 'f-school';
  const gone = 'f-gone';
  const folders = new Set([school]);
  const notes = [
    note('Algebra', { folderId: school, updatedAt: 50, tagIds: ['math'] }),
    note('Biology', { folderId: school, updatedAt: 10, favorite: 1 }),
    note('café menu', { updatedAt: 30, contentText: 'Croissant and crème brûlée' }),
    note('Ideas', { pinned: 1, updatedAt: 5, folderId: gone }),
    note('Old', { deletedAt: 99 }),
  ];

  it('sorts by last edited with pinned notes first, and leaves out deleted notes', () => {
    expect(titles(selectNotes(notes, q({}), folders))).toEqual([
      'Ideas',
      'Algebra',
      'café menu',
      'Biology',
    ]);
  });

  it('sorts by title and by creation date', () => {
    expect(titles(selectNotes(notes, q({ sort: 'title' }), folders))).toEqual([
      'Ideas',
      'Algebra',
      'Biology',
      'café menu',
    ]);
    expect(titles(selectNotes(notes, q({ sort: 'created' }), folders))[1]).toBe('café menu');
  });

  it('filters by scope, folder and tag', () => {
    expect(titles(selectNotes(notes, q({ scope: 'pinned' }), folders))).toEqual(['Ideas']);
    expect(titles(selectNotes(notes, q({ scope: 'favorites' }), folders))).toEqual(['Biology']);
    expect(titles(selectNotes(notes, q({ scope: `folder:${school}` }), folders))).toEqual([
      'Algebra',
      'Biology',
    ]);
    // A note whose folder is in the Trash counts as unfiled.
    expect(titles(selectNotes(notes, q({ scope: 'unfiled' }), folders))).toEqual([
      'Ideas',
      'café menu',
    ]);
    expect(titles(selectNotes(notes, q({ tagId: 'math' }), folders))).toEqual(['Algebra']);
  });

  it('searches title and text, ignoring case and accents, word by word', () => {
    expect(titles(selectNotes(notes, q({ text: 'CREME croissant' }), folders))).toEqual([
      'café menu',
    ]);
    expect(titles(selectNotes(notes, q({ text: 'cafe' }), folders))).toEqual(['café menu']);
    expect(matchesText(notes[0]!, '  ')).toBe(true);
    expect(matchesText(notes[0]!, 'algebra biology')).toBe(false);
  });

  it('counts notes for each scope', () => {
    const counts = scopeCounts(notes, folders);
    expect(counts).toMatchObject({ all: 4, pinned: 1, favorites: 1, unfiled: 2 });
    expect(counts.byFolder.get(school)).toBe(2);
  });

  it('reads the scope from the URL safely', () => {
    expect(parseScope('pinned')).toBe('pinned');
    expect(parseScope('folder:abc')).toBe('folder:abc');
    expect(parseScope('folder:')).toBe('all');
    expect(parseScope('weird')).toBe('all');
    expect(parseScope(null)).toBe('all');
  });

  it('makes a one-line preview without repeating the title line', () => {
    expect(snippet({ title: 'Plan', contentText: 'Line one\n\nLine   two' })).toBe(
      'Line one · Line two',
    );
    expect(snippet({ title: '', contentText: 'Shopping\nmilk\neggs' })).toBe('milk · eggs');
    expect(snippet({ title: 'x', contentText: 'y'.repeat(200) }, 20)).toHaveLength(20);
  });
});
