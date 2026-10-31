import { toast } from '@/design-system';
import { documentsRepo } from '@/data/repos/documents';
import type { Folder, LibraryDocument } from '@/data/types';
import { useItemDrop } from '@/features/folders/useItemDrop';

/** Drag type for a file card dragged onto a folder (desktop only; the file page has a menu). */
export const DOC_DRAG_TYPE = 'application/x-jasminum-document';

/** Moves a file into a folder (or out of all folders), with Undo. */
export async function moveDocument(doc: LibraryDocument, folder: Folder | null) {
  const from = doc.folderId;
  if (from === (folder?.id ?? null)) return;
  await documentsRepo.update(doc.id, { folderId: folder?.id ?? null });
  toast({
    message: folder
      ? `Moved "${doc.title}" to ${folder.name}`
      : `Took "${doc.title}" out of its folder`,
    action: { label: 'Undo', onClick: () => void documentsRepo.update(doc.id, { folderId: from }) },
  });
}

/** A drop target for dragged file cards. */
export const useDocDrop = (onDropDoc: (docId: string) => void) =>
  useItemDrop(DOC_DRAG_TYPE, onDropDoc);
