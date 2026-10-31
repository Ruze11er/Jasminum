import { toast } from '@/design-system';
import { foldersRepo } from '@/data/repos/folders';
import { notesRepo } from '@/data/repos/notes';
import type { Folder, Note } from '@/data/types';
import { firstIssue } from '@/lib/validation';

/** Shared note actions with friendly feedback. */

export async function deleteNote(note: Note) {
  await notesRepo.softDelete(note.id);
  toast({
    message: 'Note moved to Trash',
    action: { label: 'Undo', onClick: () => void notesRepo.restore(note.id) },
  });
}

export async function deleteFolder(folder: Folder) {
  await foldersRepo.softDelete(folder.id);
  toast({
    message: `Folder "${folder.name}" moved to Trash. Its notes are still in All notes.`,
    action: { label: 'Undo', onClick: () => void foldersRepo.restore(folder.id) },
  });
}

/** Returns the new folder, or null (with an error toast) if the name is invalid. */
export async function createFolder(name: string): Promise<Folder | null> {
  try {
    return await foldersRepo.add('notes', name);
  } catch (err) {
    toast({ tone: 'error', message: firstIssue(err) ?? "Couldn't create the folder" });
    return null;
  }
}

export async function renameFolder(folder: Folder, name: string): Promise<boolean> {
  try {
    await foldersRepo.update(folder.id, { name });
    return true;
  } catch (err) {
    toast({ tone: 'error', message: firstIssue(err) ?? "Couldn't rename the folder" });
    return false;
  }
}
