import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { foldersRepo } from '@/data/repos/folders';
import type { Folder, Note, Tag } from '@/data/types';

export interface NotesData {
  notes: Note[];
  folders: Folder[];
  tags: Tag[];
  folderById: Map<string, Folder>;
  tagById: Map<string, Tag>;
  /** Folders not in the Trash. Notes in a trashed folder count as unfiled. */
  activeFolderIds: Set<string>;
}

/** Live notes, note folders and tags. Note bodies are small JSON, so loading all is fine. */
export function useNotesData(): NotesData | undefined {
  return useLiveQuery(async () => {
    const [notes, folders, tags] = await Promise.all([
      db.notes.filter((n) => !n.deletedAt).toArray(),
      foldersRepo.list('notes'),
      db.tags
        .orderBy('normalizedName')
        .filter((t) => !t.deletedAt)
        .toArray(),
    ]);
    return {
      notes,
      folders,
      tags,
      folderById: new Map(folders.map((f) => [f.id, f])),
      tagById: new Map(tags.map((t) => [t.id, t])),
      activeFolderIds: new Set(folders.map((f) => f.id)),
    };
  }, []);
}
