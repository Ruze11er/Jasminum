import { useState, type ReactNode } from 'react';
import { FolderX, NotebookPen, NotebookText, Pin, Search, SearchX, Star } from 'lucide-react';
import {
  Button,
  EmptyState,
  FilterChips,
  Input,
  SelectableLink,
  Select,
  SelectButton,
} from '@/design-system';
import { noteTitle } from '@/data/repos/notes';
import type { Note } from '@/data/types';
import { FolderBanner, FolderTag } from '@/features/folders/FolderBanner';
import { FolderGrid } from '@/features/folders/FolderGrid';
import { selectFolders } from '@/features/folders/selectFolders';
import { dragSource } from '@/features/folders/useItemDrop';
import { clock } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/format';
import { useSelection, type Selection } from '@/lib/useSelection';
import { moveNote, NOTE_DRAG_TYPE } from '../noteActions';
import { NotesSelectionBar } from './NotesSelectionBar';
import {
  folderIdOf,
  notesLabel,
  scopeCounts,
  selectNotes,
  snippet,
  type NoteQuery,
  type NoteScope,
  type NoteSort,
} from '../selectors';
import type { NotesData } from '../useNotesData';

/** One note as a card: title, a preview of the text, and when, where and which tags. */
function NoteCard({
  note,
  data,
  search,
  showFolder,
  now,
  selection,
}: {
  note: Note;
} & CardContext) {
  const title = noteTitle(note);
  const preview = snippet(note, 220);
  const folder = showFolder && note.folderId ? data.folderById.get(note.folderId) : undefined;
  const tags = note.tagIds.flatMap((id) => data.tagById.get(id) ?? []).slice(0, 3);
  return (
    <SelectableLink
      selection={selection}
      id={note.id}
      label={title || 'Untitled'}
      to={`/notes/${note.id}${search}`}
      linkProps={dragSource(NOTE_DRAG_TYPE, note.id)}
      className={cn(
        'flex h-full min-h-36 flex-col rounded-2xl border border-line bg-surface p-4 shadow-soft-sm transition-[border-color,box-shadow,transform] duration-200',
        'hover:-translate-y-0.5 hover:border-primary/70 hover:shadow-soft-lg hover:ring-1 hover:ring-primary/70',
      )}
    >
      <span className="flex items-start gap-2">
        <span
          className={cn(
            'line-clamp-2 min-w-0 flex-1 font-display text-[1.05rem] font-bold break-words',
            !title && 'text-fg-muted italic',
          )}
        >
          {title || 'Untitled'}
        </span>
        {note.pinned === 1 && (
          <Pin className="mt-1 size-4 shrink-0 fill-current text-primary" aria-label="Pinned" />
        )}
        {note.favorite === 1 && (
          <Star className="mt-1 size-4 shrink-0 fill-current text-warning" aria-label="Favorite" />
        )}
      </span>
      <span
        className={cn('mt-1.5 line-clamp-4 flex-1 text-sm text-fg-muted', !preview && 'italic')}
      >
        {preview || 'No text yet'}
      </span>
      <span className="mt-3 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-fg-muted">
        <span className="mr-1">{formatRelative(note.updatedAt, now)}</span>
        {folder && <FolderTag folder={folder} />}
        {tags.map((t) => (
          <span key={t.id} className="rounded-full bg-surface-muted px-2 py-0.5">
            #{t.name}
          </span>
        ))}
      </span>
    </SelectableLink>
  );
}

function NoteGrid({ label, notes, ...card }: { label: string; notes: Note[] } & CardContext) {
  return (
    <ul aria-label={label} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {notes.map((n) => (
        <li key={n.id} className="min-w-0">
          <NoteCard note={n} {...card} />
        </li>
      ))}
    </ul>
  );
}

type CardContext = {
  data: NotesData;
  search: string;
  showFolder: boolean;
  now: number;
  selection: Selection;
};

const GroupTitle = ({ children }: { children: string }) => (
  <h3 className="mb-2 text-xs font-bold tracking-wide text-fg-muted uppercase">{children}</h3>
);

/**
 * The notes list: search, views, folders as tiles, and the notes as cards (pinned ones in
 * their own group). Filters live in the URL, and card links keep them.
 */
export function NoteList({
  data,
  query,
  onQuery,
  search,
  onNew,
}: {
  data: NotesData;
  query: NoteQuery;
  onQuery: (patch: Partial<NoteQuery>) => void;
  /** The current `?…` string, kept on note links so filters survive opening a note. */
  search: string;
  onNew: () => void;
}) {
  const [creatingFolder, setCreatingFolder] = useState(false);
  const notes = selectNotes(data.notes, query, data.activeFolderIds);
  const counts = scopeCounts(data.notes, data.activeFolderIds);
  const folderId = folderIdOf(query.scope);
  const folder = folderId ? data.folderById.get(folderId) : undefined;
  const text = query.text.trim();
  const filtering = !!query.tagId || !!text;
  const now = clock.now();

  const scopes = [
    { value: 'all', label: 'All notes', count: counts.all, icon: <NotebookText /> },
    { value: 'pinned', label: 'Pinned', count: counts.pinned, icon: <Pin /> },
    { value: 'favorites', label: 'Favorites', count: counts.favorites, icon: <Star /> },
    { value: 'unfiled', label: 'No folder', count: counts.unfiled, icon: <FolderX /> },
  ] satisfies { value: NoteScope; label: string; count: number; icon: ReactNode }[];
  const scopeLabel = scopes.find((s) => s.value === query.scope)?.label ?? 'Notes';
  const folderSummary = (id: string) => {
    const n = counts.byFolder.get(id) ?? 0;
    return n ? notesLabel(n) : 'Empty';
  };

  // Pinned notes get their own group, except in the Pinned view (where all are pinned).
  const pinned = query.scope === 'pinned' ? [] : notes.filter((n) => n.pinned);
  const others = query.scope === 'pinned' ? notes : notes.filter((n) => !n.pinned);
  const selection = useSelection([...pinned, ...others].map((n) => n.id));
  const card: CardContext = { data, search, showFolder: !folder, now, selection };

  let empty;
  if (counts.all === 0 && !folder) {
    empty = (
      <EmptyState
        icon={<NotebookPen />}
        title="No notes yet"
        description="Lecture notes, ideas, lists: write anything down."
        action={<Button onClick={onNew}>New note</Button>}
      />
    );
  } else if (folder && !filtering) {
    empty = (
      <EmptyState
        icon={<NotebookPen />}
        title="This folder is empty"
        description="New notes you write here go into this folder."
        action={<Button onClick={onNew}>New note here</Button>}
      />
    );
  } else {
    empty = (
      <EmptyState
        icon={<SearchX />}
        title="No notes match"
        description="Try other words, or clear the tag filter."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="note-search" className="sr-only">
          Search notes
        </label>
        <Input
          id="note-search"
          type="search"
          leadingIcon={<Search />}
          placeholder="Search notes and folders"
          value={query.text}
          onChange={(e) => onQuery({ text: e.target.value })}
        />
      </div>

      <FilterChips
        label="Show"
        items={scopes}
        value={query.scope}
        onChange={(scope) => onQuery({ scope })}
      />

      {folder && (
        <FolderBanner
          key={folder.id}
          folder={folder}
          summary={folderSummary(folder.id)}
          section="Notes"
          onBack={() => onQuery({ scope: 'all' })}
        />
      )}

      {query.scope === 'all' && (
        <FolderGrid
          scope="notes"
          folders={selectFolders(data.folders, text)}
          summaryOf={(f) => folderSummary(f.id)}
          drop={{
            type: NOTE_DRAG_TYPE,
            onDrop: (id, f) => {
              const note = data.notes.find((n) => n.id === id);
              if (note) void moveNote(note, f);
            },
          }}
          creating={creatingFolder}
          onCreatingChange={setCreatingFolder}
          onOpen={(f) => onQuery({ scope: `folder:${f.id}` })}
          searching={!!text}
        />
      )}

      <section aria-labelledby="notes-heading" className="space-y-3">
        {selection.active ? (
          <>
            <h2 id="notes-heading" className="sr-only">
              {folder ? 'Notes' : scopeLabel}
            </h2>
            <NotesSelectionBar selection={selection} data={data} />
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 id="notes-heading" className="flex flex-1 items-baseline gap-2 text-base">
              {folder ? 'Notes' : scopeLabel}
              <span className="text-sm font-semibold text-fg-muted">{notes.length}</span>
            </h2>
            {notes.length > 0 && <SelectButton selection={selection} />}
            {(notes.length > 0 || filtering) && (
              <div className="order-last flex w-full gap-2 sm:order-none sm:w-auto">
                {data.tags.length > 0 && (
                  <div className="min-w-0 flex-1 sm:w-40 sm:flex-none">
                    <label htmlFor="note-tag" className="sr-only">
                      Tag
                    </label>
                    <Select
                      id="note-tag"
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
                  <label htmlFor="note-sort" className="sr-only">
                    Sort by
                  </label>
                  <Select
                    id="note-sort"
                    value={query.sort}
                    onChange={(e) => onQuery({ sort: e.target.value as NoteSort })}
                  >
                    <option value="updated">Last edited</option>
                    <option value="created">Newest first</option>
                    <option value="title">Title A–Z</option>
                  </Select>
                </div>
              </div>
            )}
          </div>
        )}

        {notes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong bg-surface">
            {empty}
          </div>
        ) : pinned.length ? (
          <div className="space-y-5">
            <div>
              <GroupTitle>Pinned</GroupTitle>
              <NoteGrid label="Pinned notes" notes={pinned} {...card} />
            </div>
            {others.length > 0 && (
              <div>
                <GroupTitle>Others</GroupTitle>
                <NoteGrid label="Notes" notes={others} {...card} />
              </div>
            )}
          </div>
        ) : (
          <NoteGrid label="Notes" notes={others} {...card} />
        )}
      </section>
    </div>
  );
}
