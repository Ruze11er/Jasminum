import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { foldersRepo } from '@/data/repos/folders';
import type { Folder, LibraryDocument, Tag } from '@/data/types';

export interface LibraryData {
  docs: LibraryDocument[];
  folders: Folder[];
  tags: Tag[];
  folderById: Map<string, Folder>;
  tagById: Map<string, Tag>;
  activeFolderIds: Set<string>;
}

/** Live document metadata (never the bytes), document folders and tags. */
export function useLibraryData(): LibraryData | undefined {
  return useLiveQuery(async () => {
    const [docs, folders, tags] = await Promise.all([
      db.documents.filter((d) => !d.deletedAt).toArray(),
      foldersRepo.list('documents'),
      db.tags
        .orderBy('normalizedName')
        .filter((t) => !t.deletedAt)
        .toArray(),
    ]);
    return {
      docs,
      folders,
      tags,
      folderById: new Map(folders.map((f) => [f.id, f])),
      tagById: new Map(tags.map((t) => [t.id, t])),
      activeFolderIds: new Set(folders.map((f) => f.id)),
    };
  }, []);
}
