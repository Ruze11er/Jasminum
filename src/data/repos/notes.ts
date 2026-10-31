import { z } from '@/lib/validation';
import { logActivity } from '../activity';
import { db } from '../db';
import { createRepository, EntityNotFoundError } from '../repository';
import type { Note } from '../types';

const flag = z._default(z.union([z.literal(0), z.literal(1)]), 0);

/** Generous, but stops a runaway paste from bloating the database and search index. */
export const MAX_NOTE_TEXT = 200_000;

export const noteSchema = z.object({
  // Untitled notes are fine: the list shows the first line of text instead.
  title: z._default(
    z.string().check(z.trim(), z.maxLength(200, 'Keep the title under 200 characters')),
    '',
  ),
  /** Tiptap (ProseMirror) document JSON. null for an empty note. */
  contentJson: z._default(z.unknown(), null),
  /** Plain-text copy of the content, for search, snippets and insights. */
  contentText: z._default(
    z.string().check(z.maxLength(MAX_NOTE_TEXT, 'This note is too long to save')),
    '',
  ),
  folderId: z._default(z.nullable(z.string()), null),
  tagIds: z._default(z.array(z.string()), []),
  pinned: flag,
  favorite: flag,
});

/** The title, or the first line of text for untitled notes. Empty if both are blank. */
export function noteTitle(n: Pick<Note, 'title' | 'contentText'>): string {
  if (n.title) return n.title;
  const firstLine = n.contentText.trim().split('\n')[0] ?? '';
  return firstLine.length > 80 ? `${firstLine.slice(0, 79)}…` : firstLine;
}

export type NoteInput = z.input<typeof noteSchema>;
type NoteFields = z.output<typeof noteSchema>;

const base = createRepository<Note, NoteFields, NoteInput>({
  entityType: 'note',
  table: () => db.notes,
  schema: noteSchema,
  toSearch: (n) => ({ title: n.title, body: n.contentText }),
});

/**
 * The editor autosaves every second or so while typing. Only the first save after a
 * pause counts as a new edit in the activity log, so insights see editing sessions,
 * not keystrokes.
 */
export const EDIT_SESSION_GAP_MS = 10 * 60_000;

export const notesRepo = {
  ...base,

  async update(id: string, patch: Partial<NoteInput>): Promise<Note> {
    const before = await db.notes.get(id);
    if (!before) throw new EntityNotFoundError('note', id);
    const updated = await base.update(id, patch);
    if (updated.updatedAt - before.updatedAt >= EDIT_SESSION_GAP_MS) {
      await db.transaction('rw', db.activity, () => logActivity('note.updated', 'note', id));
    }
    return updated;
  },

  togglePinned: async (note: Note) => base.update(note.id, { pinned: note.pinned ? 0 : 1 }),

  toggleFavorite: async (note: Note) => base.update(note.id, { favorite: note.favorite ? 0 : 1 }),

  /** Moves notes to another folder (null = no folder). */
  async moveToFolder(ids: string[], folderId: string | null) {
    for (const id of ids) await base.update(id, { folderId });
  },

  /** True when there's nothing worth keeping (used before creating a new note). */
  isEmpty: (n: Pick<Note, 'title' | 'contentText'>) => !n.title.trim() && !n.contentText.trim(),
};
