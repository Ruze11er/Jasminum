import { toast } from '@/design-system';
import { documentsRepo } from '@/data/repos/documents';
import type { Folder, LibraryDocument } from '@/data/types';
import { useItemDrop } from '@/features/folders/useItemDrop';
import { filesLabel } from './selectors';

/** Drag type for a file card dragged onto a folder (desktop only; the file page has a menu). */
export const DOC_DRAG_TYPE = 'application/x-jasminum-document';

const what = (docs: LibraryDocument[]) =>
  docs.length === 1 ? `"${docs[0]!.title}"` : filesLabel(docs.length);

/** Moves files into a folder (or out of all folders), with Undo. */
export async function moveDocuments(docs: LibraryDocument[], folder: Folder | null) {
  const moving = docs.filter((d) => d.folderId !== (folder?.id ?? null));
  if (!moving.length) return;
  const before = moving.map((d) => [d.id, d.folderId] as const);
  for (const d of moving) await documentsRepo.update(d.id, { folderId: folder?.id ?? null });
  toast({
    message: folder
      ? `Moved ${what(moving)} to ${folder.name}`
      : `Took ${what(moving)} out of folders`,
    action: {
      label: 'Undo',
      onClick: () => {
        for (const [id, folderId] of before) void documentsRepo.update(id, { folderId });
      },
    },
  });
}

export const moveDocument = (doc: LibraryDocument, folder: Folder | null) =>
  moveDocuments([doc], folder);

/** Moves files to the Trash, with Undo. */
export async function deleteDocuments(docs: LibraryDocument[]) {
  for (const d of docs) await documentsRepo.softDelete(d.id);
  toast({
    message:
      docs.length === 1 ? 'File moved to Trash' : `${filesLabel(docs.length)} moved to Trash`,
    action: {
      label: 'Undo',
      onClick: () => {
        for (const d of docs) void documentsRepo.restore(d.id);
      },
    },
  });
}

/** Adds files to favorites, or removes them. */
export async function setDocumentsFavorite(docs: LibraryDocument[], favorite: boolean) {
  const changing = docs.filter((d) => !!d.favorite !== favorite);
  for (const d of changing) await documentsRepo.update(d.id, { favorite: favorite ? 1 : 0 });
  toast({
    message: favorite ? `Added ${what(docs)} to favorites` : `Removed ${what(docs)} from favorites`,
  });
}

/** A drop target for dragged file cards. */
export const useDocDrop = (onDropDoc: (docId: string) => void) =>
  useItemDrop(DOC_DRAG_TYPE, onDropDoc);
