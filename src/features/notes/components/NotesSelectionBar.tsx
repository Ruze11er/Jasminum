import { Pin, Star, Trash2 } from 'lucide-react';
import { BulkAction, SelectionBar } from '@/design-system';
import { MoveToFolder } from '@/features/folders/MoveToFolder';
import type { Selection } from '@/lib/useSelection';
import { deleteNotes, moveNotes, setNotesFavorite, setNotesPinned } from '../noteActions';
import type { NotesData } from '../useNotesData';

/** Bulk actions for selected notes: move to a folder, pin, favorite, delete. */
export function NotesSelectionBar({ selection, data }: { selection: Selection; data: NotesData }) {
  const notes = data.notes.filter((n) => selection.ids.includes(n.id));
  const none = notes.length === 0;
  const allPinned = !none && notes.every((n) => n.pinned === 1);
  const allFavorite = !none && notes.every((n) => n.favorite === 1);
  // Each action ends selection mode once it's done.
  const run = (action: Promise<unknown>) => void action.then(selection.exit);
  return (
    <SelectionBar selection={selection}>
      <MoveToFolder
        folders={data.folders}
        disabled={none}
        onMove={(folder) => run(moveNotes(notes, folder))}
      />
      <BulkAction
        icon={<Pin />}
        label={allPinned ? 'Unpin' : 'Pin'}
        disabled={none}
        onClick={() => run(setNotesPinned(notes, !allPinned))}
      />
      <BulkAction
        icon={<Star />}
        label={allFavorite ? 'Unfavorite' : 'Favorite'}
        disabled={none}
        onClick={() => run(setNotesFavorite(notes, !allFavorite))}
      />
      <BulkAction
        icon={<Trash2 />}
        label="Delete"
        variant="danger"
        disabled={none}
        onClick={() => run(deleteNotes(notes))}
      />
    </SelectionBar>
  );
}
