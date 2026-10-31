import { LayoutGrid, List, Library as LibraryIcon, Search, Upload } from 'lucide-react';
import { EmptyState, Input, SegmentedControl, Select } from '@/design-system';
import { FolderHeader, NewFolderButton } from '@/features/folders/FolderControls';
import { clock } from '@/lib/clock';
import { DOCUMENT_KINDS, KIND_LABELS } from '@/lib/fileKinds';
import { formatBytes } from '@/lib/format';
import { useUiStore, type LibraryLayout } from '@/stores/uiStore';
import type { DocumentKind } from '@/data/types';
import { useImportQueue } from '../importStore';
import {
  folderIdOfView,
  libraryCounts,
  selectDocuments,
  type LibraryQuery,
  type LibrarySort,
  type LibraryView,
} from '../selectors';
import type { LibraryData } from '../useLibraryData';
import { DocumentList } from './DocumentList';
import { FilePickerButton, primaryButtonClasses } from './FilePickerButton';
import { ImportPanel } from './ImportPanel';

/** Search, smart views, folders, type and tag filters, and the files themselves. */
export function LibraryBrowser({
  data,
  query,
  onQuery,
  search,
}: {
  data: LibraryData;
  query: LibraryQuery;
  onQuery: (patch: Partial<LibraryQuery>) => void;
  search: string;
}) {
  const now = clock.now();
  const layout = useUiStore((s) => s.libraryLayout);
  const setLayout = useUiStore((s) => s.setLibraryLayout);
  const enqueue = useImportQueue((s) => s.enqueue);
  const ctx = { activeFolderIds: data.activeFolderIds, tagById: data.tagById, now };
  const docs = selectDocuments(data.docs, query, ctx);
  const counts = libraryCounts(data.docs, ctx);
  const folderId = folderIdOfView(query.view);
  const folder = folderId ? data.folderById.get(folderId) : undefined;
  const filtering = query.view !== 'all' || !!query.kind || !!query.tagId || !!query.text.trim();
  const addFiles = (files: File[]) =>
    enqueue(files, { folderId, tagIds: query.tagId ? [query.tagId] : [] });

  const views: { value: LibraryView; label: string; count: number }[] = [
    { value: 'all', label: 'All files', count: counts.all },
    { value: 'recent', label: 'Recent', count: counts.recent },
    { value: 'opened', label: 'Recently opened', count: counts.opened },
    { value: 'favorites', label: 'Favorites', count: counts.favorites },
    { value: 'untagged', label: 'Untagged', count: counts.untagged },
    { value: 'unfiled', label: 'No folder', count: counts.unfiled },
    ...data.folders.map((f) => ({
      value: `folder:${f.id}` as LibraryView,
      label: f.name,
      count: counts.byFolder.get(f.id) ?? 0,
    })),
  ];

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="library-search" className="sr-only">
          Search files
        </label>
        <Input
          id="library-search"
          type="search"
          leadingIcon={<Search />}
          placeholder="Search by name, tag or description"
          value={query.text}
          onChange={(e) => onQuery({ text: e.target.value })}
        />
      </div>

      <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
        {views.map((v) => (
          <button
            key={v.value}
            type="button"
            aria-pressed={query.view === v.value}
            onClick={() => onQuery({ view: v.value })}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold whitespace-nowrap transition-colors aria-pressed:bg-primary aria-pressed:text-on-primary not-aria-pressed:bg-surface-muted not-aria-pressed:text-fg-muted max-md:h-10"
          >
            {v.label}
            <span className="text-xs opacity-80">{v.count}</span>
          </button>
        ))}
        <NewFolderButton scope="documents" onCreated={(f) => onQuery({ view: `folder:${f.id}` })} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-36 flex-1">
          <label htmlFor="library-kind" className="sr-only">
            Type
          </label>
          <Select
            id="library-kind"
            value={query.kind ?? ''}
            onChange={(e) => onQuery({ kind: (e.target.value || null) as DocumentKind | null })}
          >
            <option value="">All types</option>
            {DOCUMENT_KINDS.filter((k) => counts.byKind.get(k) || query.kind === k).map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k].many} ({counts.byKind.get(k) ?? 0})
              </option>
            ))}
          </Select>
        </div>
        {data.tags.length > 0 && (
          <div className="min-w-36 flex-1">
            <label htmlFor="library-tag" className="sr-only">
              Tag
            </label>
            <Select
              id="library-tag"
              value={query.tagId ?? ''}
              onChange={(e) => onQuery({ tagId: e.target.value || null })}
            >
              <option value="">All tags</option>
              {data.tags.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="min-w-36 flex-1">
          <label htmlFor="library-sort" className="sr-only">
            Sort by
          </label>
          <Select
            id="library-sort"
            value={query.view === 'opened' ? 'opened' : query.sort}
            disabled={query.view === 'opened'}
            onChange={(e) => onQuery({ sort: e.target.value as LibrarySort })}
          >
            <option value="added">Newest first</option>
            <option value="opened">Last opened</option>
            <option value="name">Name A–Z</option>
            <option value="size">Largest first</option>
          </Select>
        </div>
        <SegmentedControl<LibraryLayout>
          label="Layout"
          value={layout}
          onChange={setLayout}
          options={[
            { value: 'grid', label: <span className="sr-only">Grid</span>, icon: <LayoutGrid /> },
            { value: 'list', label: <span className="sr-only">List</span>, icon: <List /> },
          ]}
        />
      </div>

      {folder && <FolderHeader folder={folder} onDeleted={() => onQuery({ view: 'all' })} />}

      <ImportPanel />

      {docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong bg-surface">
          {filtering ? (
            <p className="px-4 py-8 text-center text-fg-muted">No files match.</p>
          ) : (
            <EmptyState
              icon={<LibraryIcon />}
              title="Your library is empty"
              description="Add PDFs, slides, ebooks and images. They're stored only on this device and work offline."
              action={
                <FilePickerButton onFiles={addFiles} className={primaryButtonClasses}>
                  <Upload aria-hidden="true" />
                  Add files
                </FilePickerButton>
              }
            />
          )}
        </div>
      ) : (
        <>
          <DocumentList docs={docs} data={data} layout={layout} search={search} now={now} />
          <p className="text-center text-sm text-fg-muted">
            {docs.length} of {counts.all} {counts.all === 1 ? 'file' : 'files'} ·{' '}
            {formatBytes(counts.totalSize)} in total
          </p>
        </>
      )}
    </div>
  );
}
