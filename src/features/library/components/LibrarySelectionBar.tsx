import { Star, Trash2 } from 'lucide-react';
import { BulkAction, SelectionBar } from '@/design-system';
import { MoveToFolder } from '@/features/folders/MoveToFolder';
import type { Selection } from '@/lib/useSelection';
import { deleteDocuments, moveDocuments, setDocumentsFavorite } from '../documentActions';
import type { LibraryData } from '../useLibraryData';

/** Bulk actions for selected files: move to a folder, favorite, delete. */
export function LibrarySelectionBar({
  selection,
  data,
}: {
  selection: Selection;
  data: LibraryData;
}) {
  const docs = data.docs.filter((d) => selection.ids.includes(d.id));
  const none = docs.length === 0;
  const allFavorite = !none && docs.every((d) => d.favorite === 1);
  // Each action ends selection mode once it's done.
  const run = (action: Promise<unknown>) => void action.then(selection.exit);
  return (
    <SelectionBar selection={selection}>
      <MoveToFolder
        folders={data.folders}
        disabled={none}
        onMove={(folder) => run(moveDocuments(docs, folder))}
      />
      <BulkAction
        icon={<Star />}
        label={allFavorite ? 'Unfavorite' : 'Favorite'}
        disabled={none}
        onClick={() => run(setDocumentsFavorite(docs, !allFavorite))}
      />
      <BulkAction
        icon={<Trash2 />}
        label="Delete"
        variant="danger"
        disabled={none}
        onClick={() => run(deleteDocuments(docs))}
      />
    </SelectionBar>
  );
}
