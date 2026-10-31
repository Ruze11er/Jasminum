import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { NotebookPen } from 'lucide-react';
import { db } from '@/data/db';
import { linksRepo, type ItemRef } from '@/data/repos/links';
import { noteTitle } from '@/data/repos/notes';
import type { Note } from '@/data/types';

/**
 * Notes linked to a task or event, shown in their forms. Links are made from the note
 * (Link button); this is the other direction. Hidden when there are none.
 */
export function LinkedNotes({ item, onOpen }: { item: ItemRef; onOpen: () => void }) {
  const notes = useLiveQuery(async () => {
    const refs = await linksRepo.linksOf(item);
    const rows = await db.notes.bulkGet(refs.filter((r) => r.type === 'note').map((r) => r.id));
    return rows.filter((n): n is Note => !!n && !n.deletedAt);
  }, [item.type, item.id]);

  if (!notes?.length) return null;
  return (
    <section aria-labelledby={`linked-notes-${item.id}`}>
      <h3 id={`linked-notes-${item.id}`} className="mb-1.5 font-sans text-sm font-semibold">
        Linked notes
      </h3>
      <ul className="space-y-1.5">
        {notes.map((n) => (
          <li key={n.id}>
            <Link
              to={`/notes/${n.id}`}
              onClick={onOpen}
              className="flex items-center gap-2 rounded-xl bg-surface-muted px-3 py-2 text-sm font-semibold hover:text-link max-md:min-h-11"
            >
              <NotebookPen className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
              <span className="min-w-0 break-words">{noteTitle(n) || 'Untitled'}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
