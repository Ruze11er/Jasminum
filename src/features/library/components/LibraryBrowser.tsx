import { useState } from 'react';
import {
  FolderOpen,
  LayoutGrid,
  List,
  Library as LibraryIcon,
  Search,
  SearchX,
  Upload,
} from 'lucide-react';
import {
  EmptyState,
  FilterChips,
  Input,
  SegmentedControl,
  Select,
  SelectButton,
} from '@/design-system';
import { FolderBanner } from '@/features/folders/FolderBanner';
import { FolderGrid } from '@/features/folders/FolderGrid';
import { clock } from '@/lib/clock';
import { DOCUMENT_KINDS, KIND_LABELS } from '@/lib/fileKinds';
import { formatBytes } from '@/lib/format';
import { useIsWide } from '@/lib/useMediaQuery';
import { useSelection } from '@/lib/useSelection';
import { useUiStore, type LibraryLayout } from '@/stores/uiStore';
import type { DocumentKind } from '@/data/types';
import { useImportQueue } from '../importStore';
import {
  filesLabel,
  folderIdOfView,
  libraryCounts,
  selectDocuments,
  selectFolders,
  type LibraryQuery,
  type LibrarySort,
} from '../selectors';
import type { LibraryData } from '../useLibraryData';
import { DocumentList } from './DocumentList';
import { FilePickerButton, primaryButtonClasses } from './FilePickerButton';
import { ImportPanel } from './ImportPanel';
import { LibrarySelectionBar } from './LibrarySelectionBar';
import { DOC_DRAG_TYPE, moveDocument } from '../documentActions';
import { VIEW_ICONS } from '../viewIcons';
import { LibrarySidebar, type ViewItem } from './LibraryNav';

/**
 * Browse the library: views and folders (a side column on wide screens, chips and tiles
 * otherwise), search, filters, and the files.
 */
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
  const wide = useIsWide();
  const [creatingFolder, setCreatingFolder] = useState(false);
  const layout = useUiStore((s) => s.libraryLayout);
  const setLayout = useUiStore((s) => s.setLibraryLayout);
  const enqueue = useImportQueue((s) => s.enqueue);
  const ctx = { activeFolderIds: data.activeFolderIds, tagById: data.tagById, now };
  const docs = selectDocuments(data.docs, query, ctx);
  const selection = useSelection(docs.map((d) => d.id));
  const counts = libraryCounts(data.docs, ctx);
  const folderId = folderIdOfView(query.view);
  const folder = folderId ? data.folderById.get(folderId) : undefined;
  const text = query.text.trim();
  const filtering = !!query.kind || !!query.tagId || !!text;
  const addFiles = (files: File[]) =>
    enqueue(files, { folderId, tagIds: query.tagId ? [query.tagId] : [] });

  const views: ViewItem[] = [
    { value: 'all', label: 'All files', count: counts.all },
    { value: 'recent', label: 'Recent', count: counts.recent },
    { value: 'opened', label: 'Recently opened', count: counts.opened },
    { value: 'favorites', label: 'Favorites', count: counts.favorites },
    { value: 'unfiled', label: 'No folder', count: counts.unfiled },
    { value: 'untagged', label: 'Untagged', count: counts.untagged },
  ];
  const viewLabel = views.find((v) => v.value === query.view)?.label ?? 'Files';
  const folderSummary = (id: string) => {
    const n = counts.byFolder.get(id) ?? 0;
    return n ? `${filesLabel(n)} · ${formatBytes(counts.sizeByFolder.get(id) ?? 0)}` : 'Empty';
  };
  // Folders show as tiles on the "All files" view; a search narrows them too.
  const shownFolders = query.view === 'all' ? selectFolders(data.folders, text) : [];

  // Phones: heading and layout toggle share a row, the dropdowns get their own below.
  const filters = (
    <div className="order-last flex w-full gap-2 sm:order-none sm:w-auto">
      <div className="min-w-0 flex-1 sm:w-40 sm:flex-none">
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
        <div className="min-w-0 flex-1 sm:w-40 sm:flex-none">
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
      <div className="min-w-0 flex-1 sm:w-40 sm:flex-none">
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
    </div>
  );
  const layoutToggle = (
    <SegmentedControl<LibraryLayout>
      label="Layout"
      value={layout}
      onChange={setLayout}
      options={[
        { value: 'grid', label: <span className="sr-only">Grid</span>, icon: <LayoutGrid /> },
        { value: 'list', label: <span className="sr-only">List</span>, icon: <List /> },
      ]}
    />
  );

  const addButton = (label: string) => (
    <FilePickerButton onFiles={addFiles} className={primaryButtonClasses}>
      <Upload aria-hidden="true" />
      {label}
    </FilePickerButton>
  );

  let empty;
  if (counts.all === 0 && !folder) {
    empty = (
      <EmptyState
        icon={<LibraryIcon />}
        title="Your library is empty"
        description="Add PDFs, slides, ebooks and images. They're stored only on this device and work offline."
        action={addButton('Add files')}
      />
    );
  } else if (folder && !filtering) {
    empty = (
      <EmptyState
        icon={<FolderOpen />}
        title="This folder is empty"
        description={
          wide
            ? 'Add files here, or drag files onto this folder in the side list.'
            : "Add files here, or move a file in from the file's page."
        }
        action={addButton('Add files here')}
      />
    );
  } else {
    empty = (
      <EmptyState
        icon={<SearchX />}
        title="No files match"
        description="Try other words, or clear the type and tag filters."
      />
    );
  }

  const main = (
    <div className="min-w-0 space-y-5">
      <div>
        <label htmlFor="library-search" className="sr-only">
          Search files
        </label>
        <Input
          id="library-search"
          type="search"
          leadingIcon={<Search />}
          placeholder="Search files and folders"
          value={query.text}
          onChange={(e) => onQuery({ text: e.target.value })}
        />
      </div>

      {!wide && (
        <FilterChips
          label="Show"
          items={views.map((v) => ({ ...v, icon: VIEW_ICONS[v.value] }))}
          value={query.view}
          onChange={(v) => onQuery({ view: v })}
        />
      )}

      {folder && (
        <FolderBanner
          key={folder.id}
          folder={folder}
          summary={folderSummary(folder.id)}
          section="Library"
          onBack={() => onQuery({ view: 'all' })}
        />
      )}

      <ImportPanel />

      {query.view === 'all' && (
        <FolderGrid
          scope="documents"
          folders={shownFolders}
          summaryOf={(f) => folderSummary(f.id)}
          drop={{
            type: DOC_DRAG_TYPE,
            onDrop: (id, f) => {
              const doc = data.docs.find((d) => d.id === id);
              if (doc) void moveDocument(doc, f);
            },
          }}
          creating={creatingFolder}
          onCreatingChange={setCreatingFolder}
          onOpen={(f) => onQuery({ view: `folder:${f.id}` })}
          searching={!!text}
        />
      )}

      <section aria-labelledby="files-heading" className="space-y-3">
        {selection.active ? (
          <>
            <h2 id="files-heading" className="sr-only">
              {folder ? 'Files' : viewLabel}
            </h2>
            <LibrarySelectionBar selection={selection} data={data} />
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 id="files-heading" className="flex flex-1 items-baseline gap-2 text-base">
              {folder ? 'Files' : viewLabel}
              <span className="text-sm font-semibold text-fg-muted">{docs.length}</span>
            </h2>
            {(docs.length > 0 || filtering) && (
              <>
                {filters}
                {docs.length > 0 && <SelectButton selection={selection} />}
                {layoutToggle}
              </>
            )}
          </div>
        )}

        {docs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong bg-surface">
            {empty}
          </div>
        ) : (
          <>
            <DocumentList
              docs={docs}
              data={data}
              layout={layout}
              search={search}
              now={now}
              showFolder={!folder}
              selection={selection}
            />
            <p className="text-center text-sm text-fg-muted">
              {docs.length} of {counts.all} {counts.all === 1 ? 'file' : 'files'} ·{' '}
              {formatBytes(counts.totalSize)} in total
            </p>
          </>
        )}
      </section>
    </div>
  );

  if (!wide) return main;
  return (
    <div className="grid grid-cols-[13rem_minmax(0,1fr)] items-start gap-6">
      <LibrarySidebar
        views={views}
        folders={data.folders.map((f) => ({
          folder: f,
          item: { value: `folder:${f.id}`, label: f.name, count: counts.byFolder.get(f.id) ?? 0 },
        }))}
        current={query.view}
        data={data}
        onSelect={(v) => onQuery({ view: v })}
        onNewFolder={() => {
          onQuery({ view: 'all', text: '' });
          setCreatingFolder(true);
        }}
      />
      {main}
    </div>
  );
}
