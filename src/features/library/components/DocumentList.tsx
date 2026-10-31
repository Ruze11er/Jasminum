import { Link } from 'react-router';
import { CircleAlert, Star } from 'lucide-react';
import type { LibraryDocument } from '@/data/types';
import type { LibraryLayout } from '@/stores/uiStore';
import { cn } from '@/lib/cn';
import { formatBytes, formatRelative } from '@/lib/format';
import { KIND_LABELS } from '@/lib/fileKinds';
import type { LibraryData } from '../useLibraryData';
import { KindIcon } from './KindIcon';

/** Files as a grid of cards or a compact list. Each opens the file's page. */
export function DocumentList({
  docs,
  data,
  layout,
  search,
  now,
}: {
  docs: LibraryDocument[];
  data: LibraryData;
  layout: LibraryLayout;
  /** The current `?…` string, kept so Back returns to the same filters. */
  search: string;
  now: number;
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
                  {d.folderId && data.folderById.get(d.folderId)
                    ? ` · ${data.folderById.get(d.folderId)!.name}`
                    : ''}
                </span>
              </span>
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
            className={cn(
              'flex h-full flex-col gap-3 rounded-2xl border border-line bg-surface p-3 shadow-soft-sm transition-shadow hover:shadow-soft-md',
            )}
          >
            <span className="flex items-start justify-between gap-2">
              <KindIcon kind={d.kind} />
              <span className="flex gap-1 pt-1">{badges(d)}</span>
            </span>
            <span className="min-w-0">
              <span className="line-clamp-2 font-semibold break-words">{d.title}</span>
              <span className="mt-1 block truncate text-xs font-semibold text-fg-muted">
                {meta(d)}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
