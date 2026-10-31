import { toast } from '@/design-system';
import { notesRepo, noteTitle } from '@/data/repos/notes';
import type { Folder, Note } from '@/data/types';
import { notesLabel } from './selectors';

/** Shared note actions with friendly feedback. */

const what = (notes: Note[]) =>
  notes.length === 1 ? `"${noteTitle(notes[0]!) || 'Untitled'}"` : notesLabel(notes.length);

/** Moves notes to the Trash, with Undo. */
export async function deleteNotes(notes: Note[]) {
  for (const n of notes) await notesRepo.softDelete(n.id);
  toast({
    message:
      notes.length === 1 ? 'Note moved to Trash' : `${notesLabel(notes.length)} moved to Trash`,
    action: {
      label: 'Undo',
      onClick: () => {
        for (const n of notes) void notesRepo.restore(n.id);
      },
    },
  });
}

export const deleteNote = (note: Note) => deleteNotes([note]);

/** Drag type for a note card dragged onto a folder (desktop; the editor has a menu). */
export const NOTE_DRAG_TYPE = 'application/x-jasminum-note';

/** Moves notes into a folder (or out of all folders), with Undo. */
export async function moveNotes(notes: Note[], folder: Folder | null) {
  const moving = notes.filter((n) => n.folderId !== (folder?.id ?? null));
  if (!moving.length) return;
  const before = moving.map((n) => [n.id, n.folderId] as const);
  for (const n of moving) await notesRepo.update(n.id, { folderId: folder?.id ?? null });
  toast({
    message: folder
      ? `Moved ${what(moving)} to ${folder.name}`
      : `Took ${what(moving)} out of folders`,
    action: {
      label: 'Undo',
      onClick: () => {
        for (const [id, folderId] of before) void notesRepo.update(id, { folderId });
      },
    },
  });
}

export const moveNote = (note: Note, folder: Folder | null) => moveNotes([note], folder);

/** Pins notes to the top, or unpins them. */
export async function setNotesPinned(notes: Note[], pinned: boolean) {
  for (const n of notes.filter((x) => !!x.pinned !== pinned))
    await notesRepo.update(n.id, { pinned: pinned ? 1 : 0 });
  toast({ message: pinned ? `Pinned ${what(notes)}` : `Unpinned ${what(notes)}` });
}

/** Adds notes to favorites, or removes them. */
export async function setNotesFavorite(notes: Note[], favorite: boolean) {
  for (const n of notes.filter((x) => !!x.favorite !== favorite))
    await notesRepo.update(n.id, { favorite: favorite ? 1 : 0 });
  toast({
    message: favorite
      ? `Added ${what(notes)} to favorites`
      : `Removed ${what(notes)} from favorites`,
  });
}
