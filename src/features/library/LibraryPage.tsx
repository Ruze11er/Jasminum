import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { Upload } from 'lucide-react';
import { PageHeader } from '@/design-system';
import { FilePickerButton, primaryButtonClasses } from './components/FilePickerButton';
import { LibraryBrowser } from './components/LibraryBrowser';
import { DocumentDetail } from './detail/DocumentDetail';
import { useImportQueue } from './importStore';
import {
  defaultLibraryQuery,
  folderIdOfView,
  isLibrarySort,
  parseKind,
  parseView,
  type LibraryQuery,
} from './selectors';
import { useLibraryData } from './useLibraryData';

const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');

/** The library: browse and find files, or look at one (`/library/<id>`). */
export default function LibraryPage() {
  const { docId = null } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const data = useLibraryData();
  const enqueue = useImportQueue((s) => s.enqueue);
  const [dragging, setDragging] = useState(false);

  const sort = params.get('sort');
  const query: LibraryQuery = {
    view: parseView(params.get('in')),
    kind: parseKind(params.get('type')),
    tagId: params.get('tag'),
    text: params.get('q') ?? '',
    sort: isLibrarySort(sort) ? sort : defaultLibraryQuery.sort,
  };
  const setQuery = (patch: Partial<LibraryQuery>) => {
    const next = { ...query, ...patch };
    const p = new URLSearchParams();
    if (next.view !== 'all') p.set('in', next.view);
    if (next.kind) p.set('type', next.kind);
    if (next.tagId) p.set('tag', next.tagId);
    if (next.text) p.set('q', next.text);
    if (next.sort !== defaultLibraryQuery.sort) p.set('sort', next.sort);
    setParams(p, { replace: true });
  };
  const target = { folderId: folderIdOfView(query.view), tagIds: query.tagId ? [query.tagId] : [] };
  const addFiles = (files: File[]) => enqueue(files, target);

  // Drop files anywhere on the page to add them (with the current folder and tag).
  const targetKey = JSON.stringify(target);
  useEffect(() => {
    if (docId) return;
    const dropTarget = JSON.parse(targetKey) as typeof target;
    let depth = 0;
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      useImportQueue.getState().enqueue(Array.from(e.dataTransfer?.files ?? []), dropTarget);
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [docId, targetKey]);

  if (docId) {
    return <DocumentDetail docId={docId} onClose={() => navigate(`/library${location.search}`)} />;
  }

  return (
    <>
      <PageHeader
        title="Library"
        actions={
          <FilePickerButton onFiles={addFiles} className={primaryButtonClasses}>
            <Upload aria-hidden="true" />
            Add files
          </FilePickerButton>
        }
      />
      {data ? (
        <LibraryBrowser data={data} query={query} onQuery={setQuery} search={location.search} />
      ) : (
        <div
          aria-busy="true"
          aria-label="Loading library"
          className="h-64 animate-pulse rounded-2xl bg-surface-muted"
        />
      )}
      {dragging && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-3 z-30 flex items-center justify-center rounded-3xl border-4 border-dashed border-brand bg-primary-soft/80 backdrop-blur-sm"
        >
          <p className="flex items-center gap-2 font-display text-2xl font-bold text-primary-soft-fg">
            <Upload className="size-7" />
            Drop files to add them
          </p>
        </div>
      )}
    </>
  );
}
