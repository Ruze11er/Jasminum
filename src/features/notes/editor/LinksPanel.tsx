import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarDays, CheckSquare, Link2, Search, X } from 'lucide-react';
import { Button, Input, Sheet, toast } from '@/design-system';
import { db } from '@/data/db';
import { linksRepo, type ItemRef, type LinkedRef } from '@/data/repos/links';
import { startDateOf } from '@/data/repos/events';
import type { CalendarEvent, Task } from '@/data/types';
import { clock } from '@/lib/clock';
import { dayLabel, localDateOf } from '@/lib/dates';
import { useEventEditor } from '@/features/calendar/eventEditorStore';
import { useTaskEditor } from '@/features/tasks/editorStore';
import { matchesText } from '../selectors';

interface Resolved {
  ref: LinkedRef;
  title: string;
  detail: string | null;
}

const today = () => localDateOf(clock.now());

function describe(ref: LinkedRef, row: Task | CalendarEvent): Resolved {
  if (ref.type === 'task') {
    const t = row as Task;
    const status = t.status === 'done' ? 'Done' : t.dueDate ? dayLabel(t.dueDate, today()) : null;
    return { ref, title: t.title, detail: status };
  }
  const e = row as CalendarEvent;
  return { ref, title: e.title, detail: dayLabel(startDateOf(e), today()) };
}

/** Everything linked to a note: tasks and events (documents arrive in Phase 6). */
export function LinksPanel({ noteId }: { noteId: string }) {
  const [picking, setPicking] = useState(false);
  const openTask = useTaskEditor((s) => s.openEdit);
  const openEvent = useEventEditor((s) => s.openEdit);
  const self: ItemRef = { type: 'note', id: noteId };

  const linked = useLiveQuery(async () => {
    const refs = await linksRepo.linksOf({ type: 'note', id: noteId });
    const rows = await Promise.all(
      refs.map(async (ref) => {
        const row =
          ref.type === 'task'
            ? await db.tasks.get(ref.id)
            : ref.type === 'event'
              ? await db.events.get(ref.id)
              : undefined;
        return row && !row.deletedAt ? describe(ref, row) : null;
      }),
    );
    return rows.filter((r): r is Resolved => r !== null);
  }, [noteId]);

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
        <h2 id={`links-${noteId}`} className="flex-1 text-sm font-semibold font-sans">
          Linked tasks and events
        </h2>
        <Button variant="ghost" size="sm" icon={<Link2 />} onClick={() => setPicking(true)}>
          Link
        </Button>
      </div>
      {linked && linked.length > 0 ? (
        <ul className="space-y-1.5" aria-label="Linked items">
          {linked.map((item) => {
            const Icon = item.ref.type === 'task' ? CheckSquare : CalendarDays;
            return (
              <li
                key={item.ref.linkId}
                className="flex items-center gap-2 rounded-xl bg-surface-muted pl-3"
              >
                <Icon className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() =>
                    item.ref.type === 'task' ? openTask(item.ref.id) : openEvent(item.ref.id)
                  }
                  className="min-w-0 flex-1 py-2 text-left text-sm hover:text-link"
                  aria-label={`Open ${item.ref.type}: ${item.title}`}
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
          Link this note to a task or an event to find it from there.
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

/** Search tasks and events to link. Open tasks and upcoming events come first. */
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
  const options = useLiveQuery(async () => {
    if (!open) return [];
    const [tasks, events] = await Promise.all([
      db.tasks.filter((t) => !t.deletedAt).toArray(),
      db.events.filter((e) => !e.deletedAt).toArray(),
    ]);
    return [
      ...tasks
        .sort((a, b) =>
          a.status === b.status ? b.updatedAt - a.updatedAt : a.status === 'todo' ? -1 : 1,
        )
        .map((t) => ({
          ref: { type: 'task' as const, id: t.id },
          title: t.title,
          text: t.description,
        })),
      ...events
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((e) => ({
          ref: { type: 'event' as const, id: e.id },
          title: e.title,
          text: e.location,
        })),
    ];
  }, [open]);

  const shown = (options ?? [])
    .filter((o) => !exclude.has(`${o.ref.type}:${o.ref.id}`))
    .filter((o) => matchesText({ title: o.title, contentText: o.text }, text))
    .slice(0, 30);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Link a task or event">
      <div className="space-y-3 pb-2">
        <div>
          <label htmlFor="link-search" className="sr-only">
            Search tasks and events
          </label>
          <Input
            id="link-search"
            type="search"
            autoFocus
            leadingIcon={<Search />}
            placeholder="Search tasks and events"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        {shown.length === 0 ? (
          <p className="py-6 text-center text-fg-muted">Nothing to link.</p>
        ) : (
          <ul aria-label="Results" className="divide-y divide-line rounded-2xl border border-line">
            {shown.map((o) => {
              const Icon = o.ref.type === 'task' ? CheckSquare : CalendarDays;
              return (
                <li key={`${o.ref.type}:${o.ref.id}`}>
                  <button
                    type="button"
                    onClick={() => void onPick(o.ref, o.title)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-muted"
                  >
                    <Icon className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
                    <span className="min-w-0 flex-1 break-words font-semibold">{o.title}</span>
                    <span className="text-xs font-semibold text-fg-muted">
                      {o.ref.type === 'task' ? 'Task' : 'Event'}
                    </span>
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
