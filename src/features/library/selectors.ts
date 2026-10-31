import type { DocumentKind, LibraryDocument, Tag } from '@/data/types';
import { DAY_MS } from '@/lib/clock';
import { DOCUMENT_KINDS } from '@/lib/fileKinds';

/** Smart views are queries, not stored folders. `folder:<id>` picks one folder. */
export type LibraryView =
  'all' | 'recent' | 'opened' | 'favorites' | 'untagged' | 'unfiled' | `folder:${string}`;
export type LibrarySort = 'added' | 'opened' | 'name' | 'size';

export interface LibraryQuery {
  view: LibraryView;
  kind: DocumentKind | null;
  tagId: string | null;
  text: string;
  sort: LibrarySort;
}

export const defaultLibraryQuery: LibraryQuery = {
  view: 'all',
  kind: null,
  tagId: null,
  text: '',
  sort: 'added',
};

/** "Recent" means added in the last 30 days. */
export const RECENT_DAYS = 30;

export function parseView(v: string | null): LibraryView {
  if (v === 'recent' || v === 'opened' || v === 'favorites' || v === 'untagged' || v === 'unfiled')
    return v;
  if (v?.startsWith('folder:') && v.length > 7) return v as LibraryView;
  return 'all';
}

export const parseKind = (v: string | null): DocumentKind | null =>
  v && (DOCUMENT_KINDS as string[]).includes(v) ? (v as DocumentKind) : null;

export const isLibrarySort = (v: string | null): v is LibrarySort =>
  v === 'added' || v === 'opened' || v === 'name' || v === 'size';

export const folderIdOfView = (view: LibraryView) =>
  view.startsWith('folder:') ? view.slice(7) : null;

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase();

/** Every word appears in the name, file name, description or a tag name. */
export function matchesDocument(
  doc: LibraryDocument,
  text: string,
  tagById: Map<string, Pick<Tag, 'name'>>,
) {
  const words = fold(text).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const tags = doc.tagIds.map((id) => tagById.get(id)?.name ?? '').join(' ');
  const haystack = fold(
    `${doc.title}\n${doc.originalFilename}\n${doc.description}\n${tags}\n${doc.ext}`,
  );
  return words.every((w) => haystack.includes(w.replace(/^#/, '')));
}

const byName = (a: LibraryDocument, b: LibraryDocument) =>
  a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true });

const comparators: Record<LibrarySort, (a: LibraryDocument, b: LibraryDocument) => number> = {
  added: (a, b) => b.addedAt - a.addedAt,
  opened: (a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0) || b.addedAt - a.addedAt,
  name: byName,
  size: (a, b) => b.size - a.size,
};

/** The documents to show. Documents in a trashed folder count as having no folder. */
export function selectDocuments(
  docs: LibraryDocument[],
  q: LibraryQuery,
  ctx: { activeFolderIds: Set<string>; tagById: Map<string, Pick<Tag, 'name'>>; now: number },
): LibraryDocument[] {
  const folderId = folderIdOfView(q.view);
  const recentSince = ctx.now - RECENT_DAYS * DAY_MS;
  const inFolder = (d: LibraryDocument) => !!d.folderId && ctx.activeFolderIds.has(d.folderId);
  // "Recently opened" is always sorted by last open.
  const sort = q.view === 'opened' ? 'opened' : q.sort;
  return docs
    .filter((d) => {
      if (d.deletedAt) return false;
      if (q.view === 'recent' && d.addedAt < recentSince) return false;
      if (q.view === 'opened' && d.lastOpenedAt === null) return false;
      if (q.view === 'favorites' && !d.favorite) return false;
      if (q.view === 'untagged' && d.tagIds.some((id) => ctx.tagById.has(id))) return false;
      if (q.view === 'unfiled' && inFolder(d)) return false;
      if (folderId && d.folderId !== folderId) return false;
      if (q.kind && d.kind !== q.kind) return false;
      if (q.tagId && !d.tagIds.includes(q.tagId)) return false;
      return matchesDocument(d, q.text, ctx.tagById);
    })
    .sort((a, b) => comparators[sort](a, b) || byName(a, b) || a.id.localeCompare(b.id));
}

export const filesLabel = (n: number) => `${n} ${n === 1 ? 'file' : 'files'}`;

export { selectFolders } from '@/features/folders/selectFolders';

/** Counts for the view chips and the type filter. */
export function libraryCounts(
  docs: LibraryDocument[],
  ctx: { activeFolderIds: Set<string>; tagById: Map<string, unknown>; now: number },
) {
  const live = docs.filter((d) => !d.deletedAt);
  const recentSince = ctx.now - RECENT_DAYS * DAY_MS;
  const byFolder = new Map<string, number>();
  const sizeByFolder = new Map<string, number>();
  const byKind = new Map<DocumentKind, number>();
  for (const d of live) {
    if (d.folderId && ctx.activeFolderIds.has(d.folderId)) {
      byFolder.set(d.folderId, (byFolder.get(d.folderId) ?? 0) + 1);
      sizeByFolder.set(d.folderId, (sizeByFolder.get(d.folderId) ?? 0) + d.size);
    }
    byKind.set(d.kind, (byKind.get(d.kind) ?? 0) + 1);
  }
  return {
    all: live.length,
    recent: live.filter((d) => d.addedAt >= recentSince).length,
    opened: live.filter((d) => d.lastOpenedAt !== null).length,
    favorites: live.filter((d) => d.favorite).length,
    untagged: live.filter((d) => !d.tagIds.some((id) => ctx.tagById.has(id))).length,
    unfiled: live.filter((d) => !d.folderId || !ctx.activeFolderIds.has(d.folderId)).length,
    totalSize: live.reduce((sum, d) => sum + d.size, 0),
    byFolder,
    sizeByFolder,
    byKind,
  };
}
