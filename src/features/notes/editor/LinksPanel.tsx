import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router';
import {
  CalendarDays,
  CheckSquare,
  FileText,
  Link2,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Button, Input, Sheet, toast } from '@/design-system';
import { db } from '@/data/db';
import { startDateOf } from '@/data/repos/events';
import { linksRepo, type ItemRef, type LinkableType, type LinkedRef } from '@/data/repos/links';
import type { CalendarEvent, LibraryDocument, Task } from '@/data/types';
import { clock } from '@/lib/clock';
import { dayLabel, localDateOf } from '@/lib/dates';
import { KIND_LABELS } from '@/lib/fileKinds';
import { useEventEditor } from '@/features/calendar/eventEditorStore';
import { useTaskEditor } from '@/features/tasks/editorStore';
import { matchesText } from '../selectors';

type Target = Exclude<LinkableType, 'note'>;

const ICONS: Record<Target, LucideIcon> = {
  task: CheckSquare,
  event: CalendarDays,
  document: FileText,
};
const NAMES: Record<Target, string> = { task: 'Task', event: 'Event', document: 'File' };

interface Resolved {
  ref: LinkedRef & { type: Target };
  title: string;
  detail: string | null;
}

const today = () => localDateOf(clock.now());

async function resolve(ref: LinkedRef): Promise<Resolved | null> {
  if (ref.type === 'task') {
    const t = await db.tasks.get(ref.id);
    if (!t || t.deletedAt) return null;
    const detail = t.status === 'done' ? 'Done' : t.dueDate ? dayLabel(t.dueDate, today()) : null;
    return { ref: { ...ref, type: 'task' }, title: t.title, detail };
  }
  if (ref.type === 'event') {
    const e = await db.events.get(ref.id);
    if (!e || e.deletedAt) return null;
    return {
      ref: { ...ref, type: 'event' },
      title: e.title,
      detail: dayLabel(startDateOf(e), today()),
    };
  }
  if (ref.type === 'document') {
    const d = await db.documents.get(ref.id);
    if (!d || d.deletedAt) return null;
    return { ref: { ...ref, type: 'document' }, title: d.title, detail: KIND_LABELS[d.kind].one };
  }
  return null;
}

/** Everything linked to a note: tasks, events and files. */
export function LinksPanel({ noteId }: { noteId: string }) {
  const [picking, setPicking] = useState(false);
  const navigate = useNavigate();
  const openTask = useTaskEditor((s) => s.openEdit);
  const openEvent = useEventEditor((s) => s.openEdit);
  const self: ItemRef = { type: 'note', id: noteId };

  const linked = useLiveQuery(async () => {
    const refs = await linksRepo.linksOf({ type: 'note', id: noteId });
    const rows = await Promise.all(refs.map(resolve));
    return rows.filter((r): r is Resolved => r !== null);
  }, [noteId]);

  const open = (item: Resolved) => {
    if (item.ref.type === 'task') openTask(item.ref.id);
    else if (item.ref.type === 'event') openEvent(item.ref.id);
    else navigate(`/library/${item.ref.id}`);
  };

  const unlink = async (item: Resolved) => {
    const link = await db.links.get(item.ref.linkId);
    await linksRepo.unlink(item.ref.linkId);
    toast({
      message: 'Link removed',
      action: link ? { label: 'Undo', onClick: () => void linksRepo.restoreLink(link) } : undefined,
    });
  };

  return (
    <section aria-labelledby={`links-${noteId}`} className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 id={`links-${noteId}`} className="flex-1 font-sans text-sm font-semibold">
          Linked tasks, events and files
        </h2>
        <Button variant="ghost" size="sm" icon={<Link2 />} onClick={() => setPicking(true)}>
          Link
        </Button>
      </div>
      {linked && linked.length > 0 ? (
        <ul className="space-y-1.5" aria-label="Linked items">
          {linked.map((item) => {
            const Icon = ICONS[item.ref.type];
            return (
              <li
                key={item.ref.linkId}
                className="flex items-center gap-2 rounded-xl bg-surface-muted pl-3"
              >
                <Icon className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => open(item)}
                  className="min-w-0 flex-1 py-2 text-left text-sm hover:text-link"
                  aria-label={`Open ${NAMES[item.ref.type].toLowerCase()}: ${item.title}`}
                >
                  <span className="font-semibold break-words">{item.title}</span>
                  {item.detail && <span className="ml-2 text-fg-muted">{item.detail}</span>}
                </button>
                <button
                  type="button"
                  onClick={() => void unlink(item)}
                  aria-label={`Remove link to ${item.title}`}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-fg-muted hover:bg-surface hover:text-fg max-md:size-11"
                >
                  <X className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-fg-muted">
          Link this note to a task, an event or a file to find it from there too.
        </p>
      )}
      <LinkPicker
        open={picking}
        onOpenChange={setPicking}
        exclude={new Set(linked?.map((l) => `${l.ref.type}:${l.ref.id}`))}
        onPick={async (ref, title) => {
          await linksRepo.link(self, ref);
          setPicking(false);
          toast({ message: `Linked to "${title}"` });
        }}
      />
    </section>
  );
}

interface Option {
  ref: { type: Target; id: string };
  title: string;
  text: string;
}

/** Search tasks, events and files to link. Open tasks come first, then recent items. */
function LinkPicker({
  open,
  onOpenChange,
  exclude,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exclude: Set<string>;
  onPick: (ref: ItemRef, title: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const options = useLiveQuery(async (): Promise<Option[]> => {
    if (!open) return [];
    const [tasks, events, docs] = await Promise.all([
      db.tasks.filter((t) => !t.deletedAt).toArray(),
      db.events.filter((e) => !e.deletedAt).toArray(),
      db.documents.filter((d) => !d.deletedAt).toArray(),
    ]);
    const byOpenThenRecent = (a: Task, b: Task) =>
      a.status === b.status ? b.updatedAt - a.updatedAt : a.status === 'todo' ? -1 : 1;
    return [
      ...tasks.sort(byOpenThenRecent).map((t) => ({
        ref: { type: 'task' as const, id: t.id },
        title: t.title,
        text: t.description,
      })),
      ...events
        .sort((a: CalendarEvent, b: CalendarEvent) => b.updatedAt - a.updatedAt)
        .map((e) => ({
          ref: { type: 'event' as const, id: e.id },
          title: e.title,
          text: e.location,
        })),
      ...docs
        .sort((a: LibraryDocument, b: LibraryDocument) => b.addedAt - a.addedAt)
        .map((d) => ({
          ref: { type: 'document' as const, id: d.id },
          title: d.title,
          text: `${d.originalFilename} ${d.description}`,
        })),
    ];
  }, [open]);

  const shown = (options ?? [])
    .filter((o) => !exclude.has(`${o.ref.type}:${o.ref.id}`))
    .filter((o) => matchesText({ title: o.title, contentText: o.text }, text))
    .slice(0, 30);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Link a task, event or file">
      <div className="space-y-3 pb-2">
        <div>
          <label htmlFor="link-search" className="sr-only">
            Search tasks, events and files
          </label>
          <Input
            id="link-search"
            type="search"
            autoFocus
            leadingIcon={<Search />}
            placeholder="Search tasks, events and files"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        {shown.length === 0 ? (
          <p className="py-6 text-center text-fg-muted">Nothing to link.</p>
        ) : (
          <ul aria-label="Results" className="divide-y divide-line rounded-2xl border border-line">
            {shown.map((o) => {
              const Icon = ICONS[o.ref.type];
              return (
                <li key={`${o.ref.type}:${o.ref.id}`}>
                  <button
                    type="button"
                    onClick={() => void onPick(o.ref, o.title)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-muted"
                  >
                    <Icon className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
                    <span className="min-w-0 flex-1 font-semibold break-words">{o.title}</span>
                    <span className="text-xs font-semibold text-fg-muted">{NAMES[o.ref.type]}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
