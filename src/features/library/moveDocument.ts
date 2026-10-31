import { useState, type DragEvent } from 'react';
import { toast } from '@/design-system';
import { documentsRepo } from '@/data/repos/documents';
import type { Folder, LibraryDocument } from '@/data/types';

/** Drag type for a file card dragged onto a folder (desktop only; the file page has a menu). */
export const DOC_DRAG_TYPE = 'application/x-jasminum-document';

export const isDocDrag = (e: DragEvent) => e.dataTransfer.types.includes(DOC_DRAG_TYPE);

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

/**
 * Makes an element a drop target for dragged file cards. `over` is true while a file is
 * held above it, for highlighting.
 */
export function useDocDrop(onDropDoc: (docId: string) => void) {
  const [over, setOver] = useState(false);
  return {
    over,
    dropProps: {
      onDragOver: (e: DragEvent<HTMLElement>) => {
        if (!isDocDrag(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOver(true);
      },
      onDragLeave: (e: DragEvent<HTMLElement>) => {
        // Moving onto a child also fires dragleave; only clear when really leaving.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      },
      onDrop: (e: DragEvent<HTMLElement>) => {
        if (!isDocDrag(e)) return;
        e.preventDefault();
        setOver(false);
        onDropDoc(e.dataTransfer.getData(DOC_DRAG_TYPE));
      },
    },
  };
}
