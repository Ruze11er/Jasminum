import { Link } from 'react-router';
import { CircleAlert, Star } from 'lucide-react';
import type { LibraryDocument } from '@/data/types';
import { FolderTag } from '@/features/folders/FolderBanner';
import { dragSource } from '@/features/folders/useItemDrop';
import type { LibraryLayout } from '@/stores/uiStore';
import { cn } from '@/lib/cn';
import { formatBytes, formatRelative } from '@/lib/format';
import { KIND_LABELS } from '@/lib/fileKinds';
import { DOC_DRAG_TYPE } from '../moveDocument';
import type { LibraryData } from '../useLibraryData';
import { KindIcon } from './KindIcon';

/** Files as a grid of cards or a compact list. Each opens the file's page. */
export function DocumentList({
  docs,
  data,
  layout,
  search,
  now,
  showFolder,
}: {
  docs: LibraryDocument[];
  data: LibraryData;
  layout: LibraryLayout;
  /** The current `?…` string, kept so Back returns to the same filters. */
  search: string;
  now: number;
  /** Label each file with its folder (off inside a folder, where it's obvious). */
  showFolder: boolean;
}) {
  const meta = (d: LibraryDocument) =>
    `${d.ext ? d.ext.toUpperCase() : KIND_LABELS[d.kind].one} · ${formatBytes(d.size)} · ${formatRelative(d.addedAt, now)}`;

  const badges = (d: LibraryDocument) => (
    <>
      {d.favorite === 1 && (
        <Star className="size-3.5 shrink-0 fill-current text-warning" aria-label="Favorite" />
      )}
      {d.fileMissing === 1 && (
        <CircleAlert className="size-3.5 shrink-0 text-danger" aria-label="File missing" />
      )}
    </>
  );

  const folderTag = (d: LibraryDocument) => {
    const folder = showFolder && d.folderId ? data.folderById.get(d.folderId) : undefined;
    return folder ? <FolderTag folder={folder} /> : null;
  };
  // Desktop: drag a file onto a folder to move it. The file page has the same as a menu.
  const dragProps = (d: LibraryDocument) => dragSource(DOC_DRAG_TYPE, d.id);

  if (layout === 'list') {
    return (
      <ul
        aria-label="Files"
        className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-soft-sm"
      >
        {docs.map((d) => (
          <li key={d.id}>
            <Link
              to={`/library/${d.id}${search}`}
              {...dragProps(d)}
              className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-muted"
            >
              <KindIcon kind={d.kind} className="size-9" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-semibold">{d.title}</span>
                  {badges(d)}
                </span>
                <span className="block truncate text-xs font-semibold text-fg-muted">
                  {meta(d)}
                </span>
              </span>
              <span className="hidden max-w-[40%] shrink-0 sm:flex">{folderTag(d)}</span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul aria-label="Files" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {docs.map((d) => (
        <li key={d.id} className="min-w-0">
          <Link
            to={`/library/${d.id}${search}`}
            {...dragProps(d)}
            className={cn(
              'flex h-full flex-col gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-soft-sm transition-[border-color,box-shadow,transform] duration-200',
              'hover:-translate-y-0.5 hover:border-primary/70 hover:shadow-soft-lg hover:ring-1 hover:ring-primary/70',
            )}
          >
            <span className="flex items-start justify-between gap-2">
              <KindIcon kind={d.kind} />
              <span className="flex gap-1 pt-1">{badges(d)}</span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="line-clamp-2 font-semibold break-words">{d.title}</span>
              <span className="mt-1 block truncate text-xs font-semibold text-fg-muted">
                {meta(d)}
              </span>
            </span>
            {folderTag(d) && <span className="flex min-w-0">{folderTag(d)}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
