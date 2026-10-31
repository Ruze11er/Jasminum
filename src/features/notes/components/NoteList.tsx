import { Link } from 'react-router';
import { NotebookPen, Pin, Search, Star } from 'lucide-react';
import { Button, Chip, EmptyState, Input, Select } from '@/design-system';
import { noteTitle } from '@/data/repos/notes';
import { clock } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/format';
import { FolderHeader, NewFolderButton } from '@/features/folders/FolderControls';
import {
  folderIdOf,
  scopeCounts,
  selectNotes,
  snippet,
  type NoteQuery,
  type NoteScope,
  type NoteSort,
} from '../selectors';
import type { NotesData } from '../useNotesData';

/** Search, filters and the list of notes. Links keep the current filters in the URL. */
export function NoteList({
  data,
  query,
  onQuery,
  selectedId,
  search,
  onNew,
}: {
  data: NotesData;
  query: NoteQuery;
  onQuery: (patch: Partial<NoteQuery>) => void;
  selectedId: string | null;
  /** The current `?…` string, kept on note links so filters survive opening a note. */
  search: string;
  onNew: () => void;
}) {
  const notes = selectNotes(data.notes, query, data.activeFolderIds);
  const counts = scopeCounts(data.notes, data.activeFolderIds);
  const folderId = folderIdOf(query.scope);
  const folder = folderId ? data.folderById.get(folderId) : undefined;
  const now = clock.now();
  const filtering = query.scope !== 'all' || !!query.tagId || !!query.text.trim();

  const scopes: { value: NoteScope; label: string; count: number }[] = [
    { value: 'all', label: 'All notes', count: counts.all },
    { value: 'pinned', label: 'Pinned', count: counts.pinned },
    { value: 'favorites', label: 'Favorites', count: counts.favorites },
    { value: 'unfiled', label: 'No folder', count: counts.unfiled },
    ...data.folders.map((f) => ({
      value: `folder:${f.id}` as NoteScope,
      label: f.name,
      count: counts.byFolder.get(f.id) ?? 0,
    })),
  ];

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="note-search" className="sr-only">
          Search notes
        </label>
        <Input
          id="note-search"
          type="search"
          leadingIcon={<Search />}
          placeholder="Search notes"
          value={query.text}
          onChange={(e) => onQuery({ text: e.target.value })}
        />
      </div>

      <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
        {scopes.map((s) => (
          <button
            key={s.value}
            type="button"
            aria-pressed={query.scope === s.value}
            onClick={() => onQuery({ scope: s.value })}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold whitespace-nowrap transition-colors aria-pressed:bg-primary aria-pressed:text-on-primary not-aria-pressed:bg-surface-muted not-aria-pressed:text-fg-muted max-md:h-10"
          >
            {s.label}
            <span className="text-xs opacity-80">{s.count}</span>
          </button>
        ))}
        <NewFolderButton scope="notes" onCreated={(f) => onQuery({ scope: `folder:${f.id}` })} />
      </div>

      <div className="flex gap-2">
        {data.tags.length > 0 && (
          <div className="min-w-0 flex-1">
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
        <div className="min-w-0 flex-1">
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

      {folder && <FolderHeader folder={folder} onDeleted={() => onQuery({ scope: 'all' })} />}

      {notes.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface">
          {filtering ? (
            <p className="px-4 py-8 text-center text-fg-muted">No notes match.</p>
          ) : (
            <EmptyState
              icon={<NotebookPen />}
              title="No notes yet"
              description="Lecture notes, ideas, lists: write anything down."
              action={<Button onClick={onNew}>New note</Button>}
            />
          )}
        </div>
      ) : (
        <ul
          aria-label="Notes"
          className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-soft-sm"
        >
          {notes.map((n) => {
            const title = noteTitle(n) || 'Untitled';
            const preview = snippet(n);
            const noteFolder = n.folderId ? data.folderById.get(n.folderId) : undefined;
            const selected = n.id === selectedId;
            return (
              <li key={n.id}>
                <Link
                  to={`/notes/${n.id}${search}`}
                  aria-current={selected ? 'page' : undefined}
                  className={cn(
                    'block px-4 py-3 transition-colors',
                    selected ? 'bg-primary-soft/60' : 'hover:bg-surface-muted',
                  )}
                >
                  <span className="flex items-start gap-2">
                    <span
                      className={cn(
                        'min-w-0 flex-1 font-semibold break-words',
                        !noteTitle(n) && 'text-fg-muted italic',
                      )}
                    >
                      {title}
                    </span>
                    {n.pinned === 1 && (
                      <Pin className="mt-1 size-3.5 shrink-0 text-primary" aria-label="Pinned" />
                    )}
                    {n.favorite === 1 && (
                      <Star
                        className="mt-1 size-3.5 shrink-0 fill-current text-warning"
                        aria-label="Favorite"
                      />
                    )}
                  </span>
                  {preview && (
                    <span className="mt-0.5 line-clamp-2 block text-sm text-fg-muted">
                      {preview}
                    </span>
                  )}
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-fg-muted">
                    <span>{formatRelative(n.updatedAt, now)}</span>
                    {noteFolder && query.scope !== `folder:${noteFolder.id}` && (
                      <Chip color="neutral" className="h-5 px-2 text-xs">
                        {noteFolder.name}
                      </Chip>
                    )}
                    {n.tagIds.slice(0, 3).map((id) => {
                      const tag = data.tagById.get(id);
                      return tag ? <span key={id}>#{tag.name}</span> : null;
                    })}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
