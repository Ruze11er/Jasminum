import type { NoteInput } from '@/data/repos/notes';

/**
 * Crash safety for the note editor. Database writes are asynchronous, so a save started
 * while the tab is closing may never finish. When the page is hidden or closed, unsaved
 * changes are also written here synchronously (localStorage), and replayed the next time
 * the note opens if they are newer than the saved note.
 */

const key = (noteId: string) => `jasminum:note-draft:${noteId}`;

export interface DraftBackup {
  at: number;
  patch: Partial<NoteInput>;
}

export function writeBackup(noteId: string, backup: DraftBackup) {
  try {
    localStorage.setItem(key(noteId), JSON.stringify(backup));
  } catch {
    // Storage full or blocked: the normal save still runs.
  }
}

export function readBackup(noteId: string): DraftBackup | null {
  try {
    const raw = localStorage.getItem(key(noteId));
    if (!raw) return null;
    const value = JSON.parse(raw) as DraftBackup;
    return typeof value?.at === 'number' && value.patch && typeof value.patch === 'object'
      ? value
      : null;
  } catch {
    return null;
  }
}

export function clearBackup(noteId: string) {
  try {
    localStorage.removeItem(key(noteId));
  } catch {
    // Nothing to do.
  }
}
