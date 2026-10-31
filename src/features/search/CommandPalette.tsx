import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CalendarDays,
  CalendarPlus,
  CheckSquare,
  FileText,
  Hash,
  ListPlus,
  NotebookPen,
  Search,
  SquarePen,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { Sheet } from '@/design-system';
import { db } from '@/data/db';
import { normalizeTagName } from '@/data/repos/tags';
import { searchIndex } from '@/data/search/searchIndex';
import type { EntityType } from '@/data/types';
import { clock } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { localDateOf } from '@/lib/dates';
import { mainNav, settingsNav, trashNav } from '@/app/navigation';
import { useEventEditor } from '@/features/calendar/eventEditorStore';
import { useTaskEditor } from '@/features/tasks/editorStore';
import { useUiStore } from '@/stores/uiStore';
// Importing the repositories registers them as search sources for `rebuild()`.
import '@/data/trash';

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: () => void;
}

const TYPE_GROUPS: Partial<
  Record<EntityType, { group: string; icon: LucideIcon; untitled: string }>
> = {
  task: { group: 'Tasks', icon: CheckSquare, untitled: 'Untitled task' },
  event: { group: 'Events', icon: CalendarDays, untitled: 'Untitled event' },
  note: { group: 'Notes', icon: NotebookPen, untitled: 'Untitled note' },
  document: { group: 'Files', icon: FileText, untitled: 'Untitled file' },
  tag: { group: 'Tags', icon: Hash, untitled: 'Tag' },
};
const GROUP_ORDER = ['Actions', 'Tasks', 'Events', 'Notes', 'Files', 'Tags', 'Tagged', 'Go to'];
const PER_GROUP = 8;

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase();

/**
 * Search everything from anywhere (Ctrl/Cmd+K, or the search buttons). Arrow keys move,
 * Enter opens. Typing "#tag" lists everything with that tag. Loaded on first use.
 */
export default function CommandPalette() {
  const open = useUiStore((s) => s.paletteOpen);
  const setOpen = useUiStore((s) => s.setPaletteOpen);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [indexVersion, setIndexVersion] = useState(0);
  const listId = useId();

  // The index is built at start-up in idle time; make sure it's there.
  useEffect(() => {
    if (open && searchIndex.size === 0) {
      void searchIndex.rebuild().then(() => setIndexVersion((v) => v + 1));
    }
  }, [open]);

  const close = () => {
    setOpen(false);
    setQuery('');
    setActive(0);
  };
  const go = (to: string) => {
    close();
    navigate(to);
  };

  const q = query.trim();
  const tagName = q.startsWith('#') ? normalizeTagName(q).key : null;

  const tagged = useLiveQuery(async (): Promise<Item[]> => {
    if (!tagName) return [];
    const tag = await db.tags.where('normalizedName').equals(tagName).first();
    if (!tag || tag.deletedAt) return [];
    const [tasks, events, notes, docs] = await Promise.all([
      db.tasks
        .where('tagIds')
        .equals(tag.id)
        .filter((t) => !t.deletedAt)
        .toArray(),
      db.events
        .where('tagIds')
        .equals(tag.id)
        .filter((e) => !e.deletedAt)
        .toArray(),
      db.notes
        .where('tagIds')
        .equals(tag.id)
        .filter((n) => !n.deletedAt)
        .toArray(),
      db.documents
        .where('tagIds')
        .equals(tag.id)
        .filter((d) => !d.deletedAt)
        .toArray(),
    ]);
    const item = (type: EntityType, id: string, title: string): Item => ({
      id: `tagged:${type}:${id}`,
      group: 'Tagged',
      label: title || TYPE_GROUPS[type]!.untitled,
      hint: TYPE_GROUPS[type]!.group.slice(0, -1),
      icon: TYPE_GROUPS[type]!.icon,
      run: () => openEntity(type, id),
    });
    return [
      ...tasks.map((t) => item('task', t.id, t.title)),
      ...events.map((e) => item('event', e.id, e.title)),
      ...notes.map((n) => item('note', n.id, n.title || n.contentText.split('\n')[0]!)),
      ...docs.map((d) => item('document', d.id, d.title)),
    ];
  }, [tagName]);

  function openEntity(type: EntityType, id: string) {
    if (type === 'task') {
      close();
      useTaskEditor.getState().openEdit(id);
    } else if (type === 'event') {
      close();
      useEventEditor.getState().openEdit(id);
    } else if (type === 'note') go(`/notes/${id}`);
    else if (type === 'document') go(`/library/${id}`);
  }

  const items = useMemo((): Item[] => {
    const actions: Item[] = [
      {
        id: 'new-task',
        group: 'Actions',
        label: 'New task',
        icon: ListPlus,
        run: () => {
          close();
          useTaskEditor.getState().openNew({ dueDate: localDateOf(clock.now()) });
        },
      },
      {
        id: 'new-event',
        group: 'Actions',
        label: 'New event',
        icon: CalendarPlus,
        run: () => {
          close();
          useEventEditor.getState().openNew();
        },
      },
      {
        id: 'new-note',
        group: 'Actions',
        label: 'New note',
        icon: SquarePen,
        run: () => go('/notes/new'),
      },
      {
        id: 'add-files',
        group: 'Actions',
        label: 'Add files',
        icon: Upload,
        run: () => go('/library'),
      },
      ...[...mainNav, trashNav, settingsNav].map((n) => ({
        id: `go:${n.to}`,
        group: 'Go to',
        label: n.label,
        icon: n.icon,
        run: () => go(n.to),
      })),
    ];
    if (!q) return actions;
    if (tagName) return tagged ?? [];

    const words = fold(q).split(/\s+/);
    const matchingActions = actions.filter((a) => words.every((w) => fold(a.label).includes(w)));
    const hits = searchIndex.search(q, { limit: 60 }).flatMap((hit): Item[] => {
      const meta = TYPE_GROUPS[hit.type];
      if (!meta) return [];
      return [
        {
          id: `${hit.type}:${hit.id}`,
          group: meta.group,
          label: hit.title || meta.untitled,
          icon: meta.icon,
          run: () =>
            hit.type === 'tag'
              ? (setQuery(`#${hit.title}`), setActive(0))
              : openEntity(hit.type, hit.id),
        },
      ];
    });
    const perGroup = new Map<string, number>();
    const limited = hits.filter((h) => {
      const n = (perGroup.get(h.group) ?? 0) + 1;
      perGroup.set(h.group, n);
      return n <= PER_GROUP;
    });
    return [...matchingActions, ...limited].sort(
      (a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group),
    );
    // Recomputed when the query, tag results or index change; actions are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tagName, tagged, indexVersion]);

  const current = Math.min(active, Math.max(0, items.length - 1));
  const optionId = (i: number) => `${listId}-${i}`;

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!items.length) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      const next = (current + step + items.length) % items.length;
      setActive(next);
      document.getElementById(optionId(next))?.scrollIntoView?.({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[current]?.run();
    }
  };

  let lastGroup = '';
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close())}
      title="Search"
      className="md:max-w-xl"
    >
      <div className="space-y-3 pb-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-fg-muted"
            aria-hidden="true"
          />
          <input
            autoFocus
            role="combobox"
            aria-label="Search everything"
            aria-expanded={items.length > 0}
            aria-controls={listId}
            aria-activedescendant={items.length ? optionId(current) : undefined}
            aria-autocomplete="list"
            value={query}
            placeholder="Search tasks, notes, files… or #tag"
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            className="h-12 w-full rounded-xl border-[1.5px] border-line bg-surface pr-3 pl-10 text-fg outline-none placeholder:text-fg-subtle focus:border-brand focus:ring-[3px] focus:ring-ring"
          />
        </div>

        <ul
          id={listId}
          role="listbox"
          aria-label="Results"
          className="max-h-[55dvh] overflow-y-auto"
        >
          {items.length === 0 && (
            <li role="presentation" className="px-3 py-8 text-center text-fg-muted">
              {tagName ? 'Nothing has this tag.' : 'No matches.'}
            </li>
          )}
          {items.map((item, i) => {
            const heading = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            const Icon = item.icon;
            return (
              <li key={item.id} role="presentation">
                {heading && (
                  <p
                    role="presentation"
                    className="px-3 pt-3 pb-1 text-xs font-bold text-fg-muted uppercase"
                  >
                    {heading === 'Tagged' ? `Tagged ${q}` : heading}
                  </p>
                )}
                <div
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === current}
                  onClick={() => item.run()}
                  onMouseMove={() => i !== current && setActive(i)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 max-md:min-h-11',
                    i === current ? 'bg-primary-soft text-primary-soft-fg' : 'text-fg',
                  )}
                >
                  <Icon className="size-4 shrink-0 opacity-80" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate font-semibold">{item.label}</span>
                  {item.hint && (
                    <span className="text-xs font-semibold opacity-80">{item.hint}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="hidden text-xs text-fg-muted md:block">
          ↑ ↓ to move · Enter to open · Esc to close
        </p>
      </div>
    </Sheet>
  );
}
