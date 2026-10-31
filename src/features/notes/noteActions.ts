import { toast } from '@/design-system';
import { notesRepo } from '@/data/repos/notes';
import type { Note } from '@/data/types';

/** Shared note actions with friendly feedback. */

export async function deleteNote(note: Note) {
  await notesRepo.softDelete(note.id);
  toast({
    message: 'Note moved to Trash',
    action: { label: 'Undo', onClick: () => void notesRepo.restore(note.id) },
  });
}
