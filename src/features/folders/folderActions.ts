import { toast } from '@/design-system';
import { foldersRepo } from '@/data/repos/folders';
import type { Folder, FolderScope } from '@/data/types';
import { firstIssue } from '@/lib/validation';

/** Folder actions with friendly feedback, for notes and documents. */

export async function deleteFolder(folder: Folder) {
  await foldersRepo.softDelete(folder.id);
  toast({
    message: `Folder "${folder.name}" moved to Trash. Its contents are still in the list.`,
    action: { label: 'Undo', onClick: () => void foldersRepo.restore(folder.id) },
  });
}

/** Returns the new folder, or null (with an error toast) if the name is invalid. */
export async function createFolder(scope: FolderScope, name: string): Promise<Folder | null> {
  try {
    return await foldersRepo.add(scope, name);
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
