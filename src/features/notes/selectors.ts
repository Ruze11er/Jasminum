import type { Note } from '@/data/types';
import { noteTitle } from '@/data/repos/notes';

/** Route id for a note that hasn't been saved yet: /notes/new. */
export const NEW_NOTE = 'new';

/** Which notes the list shows. `folder:<id>` picks one folder. */
export type NoteScope = 'all' | 'pinned' | 'favorites' | 'unfiled' | `folder:${string}`;
export type NoteSort = 'updated' | 'created' | 'title';

export interface NoteQuery {
  scope: NoteScope;
  tagId: string | null;
  text: string;
  sort: NoteSort;
}

export const defaultNoteQuery: NoteQuery = { scope: 'all', tagId: null, text: '', sort: 'updated' };

export const isNoteSort = (v: string | null): v is NoteSort =>
  v === 'updated' || v === 'created' || v === 'title';

export function parseScope(v: string | null): NoteScope {
  if (v === 'pinned' || v === 'favorites' || v === 'unfiled') return v;
  if (v?.startsWith('folder:') && v.length > 7) return v as NoteScope;
  return 'all';
}

export const folderIdOf = (scope: NoteScope) =>
  scope.startsWith('folder:') ? scope.slice(7) : null;

/** Lower-case and strip accents, so "cafe" finds "Café". */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase();

/** Every word of the query appears in the title or text. */
export function matchesText(note: Pick<Note, 'title' | 'contentText'>, text: string) {
  const words = fold(text).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = fold(`${note.title}\n${note.contentText}`);
  return words.every((w) => haystack.includes(w));
}

const compareTitle = (a: Note, b: Note) =>
  (noteTitle(a) || '￿').localeCompare(noteTitle(b) || '￿', undefined, {
    sensitivity: 'base',
    numeric: true,
  });

const comparators: Record<NoteSort, (a: Note, b: Note) => number> = {
  updated: (a, b) => b.updatedAt - a.updatedAt,
  created: (a, b) => b.createdAt - a.createdAt,
  title: compareTitle,
};

/**
 * The notes to list for a query, pinned notes first. Notes whose folder was moved to the
 * Trash count as having no folder (`activeFolderIds` holds the folders still in use).
 */
export function selectNotes(notes: Note[], q: NoteQuery, activeFolderIds: Set<string>): Note[] {
  const folderId = folderIdOf(q.scope);
  const inFolder = (n: Note) => !!n.folderId && activeFolderIds.has(n.folderId);
  return notes
    .filter((n) => {
      if (n.deletedAt) return false;
      if (q.scope === 'pinned' && !n.pinned) return false;
      if (q.scope === 'favorites' && !n.favorite) return false;
      if (q.scope === 'unfiled' && inFolder(n)) return false;
      if (folderId && n.folderId !== folderId) return false;
      if (q.tagId && !n.tagIds.includes(q.tagId)) return false;
      return matchesText(n, q.text);
    })
    .sort((a, b) => b.pinned - a.pinned || comparators[q.sort](a, b) || b.id.localeCompare(a.id));
}

/** Counts for the scope chips. */
export function scopeCounts(notes: Note[], activeFolderIds: Set<string>) {
  const live = notes.filter((n) => !n.deletedAt);
  const byFolder = new Map<string, number>();
  for (const n of live) {
    if (n.folderId && activeFolderIds.has(n.folderId))
      byFolder.set(n.folderId, (byFolder.get(n.folderId) ?? 0) + 1);
  }
  return {
    all: live.length,
    pinned: live.filter((n) => n.pinned).length,
    favorites: live.filter((n) => n.favorite).length,
    unfiled: live.filter((n) => !n.folderId || !activeFolderIds.has(n.folderId)).length,
    byFolder,
  };
}

/**
 * A short preview of the text, skipping the line already used as the title. Lines are
 * joined with " · " so headings and list items don't run together.
 */
export function snippet(note: Pick<Note, 'title' | 'contentText'>, length = 120): string {
  let lines = note.contentText
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (!note.title) lines = lines.slice(1);
  const text = lines.join(' · ');
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}
