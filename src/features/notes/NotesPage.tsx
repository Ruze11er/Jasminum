import { lazy, Suspense, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { NotebookPen, Plus } from 'lucide-react';
import { Button, EmptyState, PageHeader } from '@/design-system';
import { useIsDesktop } from '@/lib/useMediaQuery';
import { NoteList } from './components/NoteList';
import {
  defaultNoteQuery,
  folderIdOf,
  isNoteSort,
  NEW_NOTE,
  parseScope,
  type NoteQuery,
} from './selectors';
import { useNotesData } from './useNotesData';

// Tiptap is large, so the editor downloads only when a note is opened.
const NoteEditor = lazy(() => import('./editor/NoteEditor'));

const EditorSkeleton = () => (
  <div
    aria-busy="true"
    aria-label="Loading note"
    className="h-96 animate-pulse rounded-2xl bg-surface-muted"
  />
);

/**
 * Notes: a list (with search and filters) and the editor. Two panes on larger screens;
 * on phones the list and the editor are separate screens. Filters live in the URL.
 */
export default function NotesPage() {
  const { noteId = null } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const desktop = useIsDesktop();
  const data = useNotesData();

  const sort = params.get('sort');
  const query: NoteQuery = {
    scope: parseScope(params.get('in')),
    tagId: params.get('tag'),
    text: params.get('q') ?? '',
    sort: isNoteSort(sort) ? sort : defaultNoteQuery.sort,
  };
  const setQuery = (patch: Partial<NoteQuery>) => {
    const next = { ...query, ...patch };
    const p = new URLSearchParams();
    if (next.scope !== 'all') p.set('in', next.scope);
    if (next.tagId) p.set('tag', next.tagId);
    if (next.text) p.set('q', next.text);
    if (next.sort !== defaultNoteQuery.sort) p.set('sort', next.sort);
    setParams(p, { replace: true });
  };
  const search = location.search;

  // When a new note is first saved, the URL changes from /notes/new to /notes/<id>.
  // Keeping the same React key stops the editor from reloading mid-sentence.
  const [adopted, setAdopted] = useState<{ id: string; key: string } | null>(null);
  const editorKey =
    noteId === NEW_NOTE
      ? `new:${location.key}`
      : adopted?.id === noteId
        ? adopted.key
        : (noteId ?? '');

  const newNote = () => navigate(`/notes/${NEW_NOTE}${search}`);
  const closeNote = () => navigate(`/notes${search}`);

  const editor = noteId && (
    <Suspense fallback={<EditorSkeleton />}>
      <NoteEditor
        key={editorKey}
        noteId={noteId}
        defaultFolderId={folderIdOf(query.scope)}
        onCreated={(id) => {
          setAdopted({ id, key: editorKey });
          navigate(`/notes/${id}${search}`, { replace: true });
        }}
        onClose={closeNote}
        showBack={!desktop}
      />
    </Suspense>
  );

  const list = data ? (
    <NoteList
      data={data}
      query={query}
      onQuery={setQuery}
      selectedId={noteId}
      search={search}
      onNew={newNote}
    />
  ) : (
    <div
      aria-busy="true"
      aria-label="Loading notes"
      className="h-64 animate-pulse rounded-2xl bg-surface-muted"
    />
  );

  // Phone, note open: the editor is the whole screen.
  if (!desktop && noteId) return editor;

  return (
    <>
      <PageHeader
        title="Notes"
        actions={
          <Button icon={<Plus />} onClick={newNote}>
            New note
          </Button>
        }
      />
      {desktop ? (
        <div className="grid grid-cols-[minmax(15rem,19rem)_minmax(0,1fr)] items-start gap-6">
          <div>{list}</div>
          <div>
            {editor || (
              <div className="rounded-2xl border border-dashed border-line">
                <EmptyState
                  icon={<NotebookPen />}
                  title="Pick a note"
                  description="Choose a note from the list, or start a new one."
                  action={<Button onClick={newNote}>New note</Button>}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        list
      )}
    </>
  );
}
