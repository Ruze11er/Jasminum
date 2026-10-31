import './editor.css';
import { useEffect, useId, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import { ArrowLeft, Pin, Star, Trash2 } from 'lucide-react';
import { IconButton, Select, toast } from '@/design-system';
import { db } from '@/data/db';
import { foldersRepo } from '@/data/repos/folders';
import { notesRepo, type NoteInput } from '@/data/repos/notes';
import { tagsRepo } from '@/data/repos/tags';
import type { Note } from '@/data/types';
import { clock } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/format';
import { firstIssue } from '@/lib/validation';
import { TagInput } from '@/features/tasks/editor/TagInput';
import { deleteNote } from '../noteActions';
import { NEW_NOTE } from '../selectors';
import { LinksPanel } from './LinksPanel';
import { clearBackup, readBackup, writeBackup } from './draftBackup';
import { Toolbar } from './Toolbar';

const SAVE_DELAY_MS = 700;

export interface NoteEditorProps {
  /** A note id, or `NEW_NOTE` to start a new one (saved once there's something in it). */
  noteId: string;
  /** Folder for a new note (the folder being viewed). */
  defaultFolderId: string | null;
  /** Called once a new note is first saved, with its id. */
  onCreated: (id: string) => void;
  /** Leave the editor (Back on phones, and after deleting). */
  onClose: () => void;
  showBack: boolean;
}

/** The note editor. Lazy-loaded: Tiptap is the biggest library in the app. */
export default function NoteEditor(props: NoteEditorProps) {
  const [startedNew] = useState(props.noteId === NEW_NOTE);
  const id = props.noteId === NEW_NOTE ? null : props.noteId;
  const live = useLiveQuery(async () => (id ? ((await db.notes.get(id)) ?? null) : null), [id]);
  // The editor is filled once, from the first load; later changes come from the editor itself.
  const [initial, setInitial] = useState<Note | null | undefined>(startedNew ? null : undefined);
  // Changes that were still being saved when the tab closed last time (see draftBackup.ts).
  const [recovered, setRecovered] = useState<Partial<NoteInput> | null>(null);
  if (initial === undefined && live !== undefined) {
    const backup = live ? readBackup(live.id) : null;
    if (live && backup && backup.at > live.updatedAt) {
      setInitial({ ...live, ...backup.patch } as Note);
      setRecovered(backup.patch);
    } else {
      if (live && backup) clearBackup(live.id);
      setInitial(live);
    }
  }

  if (initial === undefined) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading note"
        className="h-96 animate-pulse rounded-2xl bg-surface-muted"
      />
    );
  }
  if ((!startedNew && initial === null) || live?.deletedAt) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-4 py-10 text-center text-fg-muted">
        This note no longer exists.
      </div>
    );
  }
  return <NoteForm {...props} initial={initial} live={live ?? null} recovered={recovered} />;
}

/** 'dirty' = changed, waiting for the autosave. */
type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

function NoteForm({
  initial,
  live,
  defaultFolderId,
  onCreated,
  onClose,
  showBack,
  recovered,
}: NoteEditorProps & {
  initial: Note | null;
  live: Note | null;
  recovered: Partial<NoteInput> | null;
}) {
  const ids = { title: useId(), folder: useId(), tags: useId() };
  const [title, setTitle] = useState(initial?.title ?? '');
  const [status, setStatus] = useState<SaveStatus>(initial ? 'saved' : 'idle');

  // Autosave: edits collect in `pending` and are written shortly after typing stops.
  // Writes run one after another, so a new note is created exactly once.
  const noteId = useRef<string | null>(initial?.id ?? null);
  const pending = useRef<Partial<NoteInput>>({});
  /** The patch being written right now (kept for the backup until the write finishes). */
  const inFlight = useRef<Partial<NoteInput>>({});
  const draft = useRef({ title: initial?.title ?? '', contentText: initial?.contentText ?? '' });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const callbacks = useRef({ onCreated, defaultFolderId });
  useEffect(() => {
    callbacks.current = { onCreated, defaultFolderId };
  });

  const flush = (force = false) => {
    clearTimeout(timer.current);
    queue.current = queue.current.then(async () => {
      const patch = pending.current;
      if (!Object.keys(patch).length) return;
      // Don't create a note until it has something in it (or a setting was changed).
      if (!noteId.current && !force && notesRepo.isEmpty(draft.current)) return;
      pending.current = {};
      inFlight.current = patch;
      setStatus('saving');
      try {
        if (noteId.current) {
          await notesRepo.update(noteId.current, patch);
        } else {
          const created = await notesRepo.create({
            folderId: callbacks.current.defaultFolderId,
            ...patch,
          });
          noteId.current = created.id;
          callbacks.current.onCreated(created.id);
        }
        inFlight.current = {};
        if (!Object.keys(pending.current).length) {
          clearBackup(noteId.current);
          setStatus('saved');
        }
      } catch (err) {
        inFlight.current = {};
        pending.current = { ...patch, ...pending.current };
        setStatus('error');
        toast({ tone: 'error', message: firstIssue(err) ?? "Couldn't save the note" });
      }
    });
    return queue.current;
  };

  const save = (patch: Partial<NoteInput>, now = false) => {
    pending.current = { ...pending.current, ...patch };
    setStatus('dirty');
    if (now) {
      void flush(true);
    } else {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    }
  };
  const saveRef = useRef(save);
  const flushRef = useRef(flush);
  useEffect(() => {
    saveRef.current = save;
    flushRef.current = flush;
  });

  // Save straight away when leaving the note, hiding the app or closing the tab. The
  // backup is written synchronously in case the tab closes before the save finishes.
  useEffect(() => {
    const leave = () => {
      const unsaved = { ...inFlight.current, ...pending.current };
      if (noteId.current && Object.keys(unsaved).length) {
        writeBackup(noteId.current, { at: clock.now(), patch: unsaved });
      }
      void flushRef.current();
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') leave();
    };
    const onPageHide = leave;
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      void flushRef.current();
    };
  }, []);

  // Finish saving changes recovered from a backup.
  useEffect(() => {
    if (recovered) saveRef.current(recovered, true);
  }, [recovered]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Only http(s), mailto and tel links are allowed (the default); clicking edits.
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Start writing…' }),
    ],
    content: (initial?.contentJson as JSONContent | null) ?? '',
    editorProps: {
      attributes: {
        class: 'note-content',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Note text',
      },
    },
    onUpdate: ({ editor: e }) => {
      const contentText = e.getText({ blockSeparator: '\n' });
      draft.current.contentText = contentText;
      saveRef.current({ contentJson: e.isEmpty ? null : e.getJSON(), contentText });
    },
  });

  const lookups = useLiveQuery(async () => {
    const [folders, tags] = await Promise.all([
      foldersRepo.list('notes'),
      db.tags
        .orderBy('normalizedName')
        .filter((t) => !t.deletedAt)
        .toArray(),
    ]);
    return { folders, tags, tagById: new Map(tags.map((t) => [t.id, t.name])) };
  }, []);

  // Changing any of these on a new note saves it at once, so `live` takes over quickly.
  const folderId = live ? live.folderId : defaultFolderId;
  const pinned = !!live?.pinned;
  const favorite = !!live?.favorite;
  const tagNames = (live?.tagIds ?? [])
    .map((t) => lookups?.tagById.get(t))
    .filter((n): n is string => !!n);
  const now = clock.now();

  return (
    <article aria-label="Note" className="space-y-4">
      <div className="flex items-center gap-1">
        {showBack && <IconButton label="Back to notes" icon={<ArrowLeft />} onClick={onClose} />}
        <p className="flex-1 truncate px-1 text-sm text-fg-muted">
          {status === 'saving' || status === 'dirty'
            ? 'Saving…'
            : status === 'error'
              ? 'Not saved'
              : live
                ? `Edited ${formatRelative(live.updatedAt, now)}`
                : 'New note'}
        </p>
        <IconButton
          label={pinned ? 'Unpin' : 'Pin to top'}
          aria-pressed={pinned}
          icon={<Pin className={cn(pinned && 'fill-current')} />}
          className={cn(pinned && 'text-primary')}
          onClick={() => save({ pinned: pinned ? 0 : 1 }, true)}
        />
        <IconButton
          label={favorite ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={favorite}
          icon={<Star className={cn(favorite && 'fill-current')} />}
          className={cn(favorite && 'text-warning')}
          onClick={() => save({ favorite: favorite ? 0 : 1 }, true)}
        />
        {live && (
          <IconButton
            label="Delete note"
            icon={<Trash2 />}
            onClick={() => {
              void flush().then(() => deleteNote(live));
              onClose();
            }}
          />
        )}
      </div>

      <div>
        <label htmlFor={ids.title} className="sr-only">
          Title
        </label>
        <input
          id={ids.title}
          value={title}
          maxLength={200}
          autoFocus={!initial}
          placeholder="Title"
          onChange={(e) => {
            setTitle(e.target.value);
            draft.current.title = e.target.value;
            save({ title: e.target.value });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              editor?.commands.focus('start');
            }
          }}
          className="w-full bg-transparent font-display text-2xl font-bold outline-none placeholder:text-fg-subtle md:text-3xl"
        />
      </div>

      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} className="note-editor" />

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor={ids.folder} className="mb-1.5 block text-sm font-semibold">
            Folder
          </label>
          <Select
            id={ids.folder}
            value={folderId ?? ''}
            onChange={(e) => save({ folderId: e.target.value || null }, true)}
          >
            <option value="">No folder</option>
            {lookups?.folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor={ids.tags} className="mb-1.5 block text-sm font-semibold">
            Tags
          </label>
          <TagInput
            id={ids.tags}
            value={tagNames}
            suggestions={lookups?.tags.map((t) => t.name) ?? []}
            onChange={(names) =>
              void Promise.all(names.map((n) => tagsRepo.ensure(n))).then((tags) =>
                save({ tagIds: tags.map((t) => t.id) }, true),
              )
            }
          />
        </div>
      </div>

      {live && <LinksPanel noteId={live.id} />}
    </article>
  );
}
