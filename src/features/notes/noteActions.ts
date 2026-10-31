import { toast } from '@/design-system';
import { notesRepo, noteTitle } from '@/data/repos/notes';
import type { Folder, Note } from '@/data/types';

/** Shared note actions with friendly feedback. */

export async function deleteNote(note: Note) {
  await notesRepo.softDelete(note.id);
  toast({
    message: 'Note moved to Trash',
    action: { label: 'Undo', onClick: () => void notesRepo.restore(note.id) },
  });
}

/** Drag type for a note card dragged onto a folder (desktop; the editor has a menu). */
export const NOTE_DRAG_TYPE = 'application/x-jasminum-note';

/** Moves a note into a folder (or out of all folders), with Undo. */
export async function moveNote(note: Note, folder: Folder | null) {
  const from = note.folderId;
  if (from === (folder?.id ?? null)) return;
  await notesRepo.update(note.id, { folderId: folder?.id ?? null });
  toast({
    message: folder
      ? `Moved "${noteTitle(note) || 'Untitled'}" to ${folder.name}`
      : `Took "${noteTitle(note) || 'Untitled'}" out of its folder`,
    action: { label: 'Undo', onClick: () => void notesRepo.update(note.id, { folderId: from }) },
  });
}
