import type { Table } from 'dexie';
import { clock } from '@/lib/clock';
import { uuidv7 } from '@/lib/ids';
import { db } from '../db';
import { EntityNotFoundError } from '../repository';
import type { BaseEntity, EntityType, Link } from '../types';

/**
 * Links connect any two items, e.g. a note attached to a task or an event. A link is
 * stored once but works in both directions: `linksOf` finds it from either end.
 * Erasing an item for good removes its links (see `purge` in repository.ts).
 */

export type LinkableType = Extract<EntityType, 'task' | 'event' | 'note' | 'document'>;

export interface ItemRef {
  type: LinkableType;
  id: string;
}

/** The item at the other end of a link, from the point of view of one item. */
export interface LinkedRef extends ItemRef {
  linkId: string;
  createdAt: number;
}

const tables: Record<LinkableType, () => Table<BaseEntity, string>> = {
  task: () => db.tasks as unknown as Table<BaseEntity, string>,
  event: () => db.events as unknown as Table<BaseEntity, string>,
  note: () => db.notes as unknown as Table<BaseEntity, string>,
  document: () => db.documents as unknown as Table<BaseEntity, string>,
};

const same = (a: ItemRef, b: ItemRef) => a.type === b.type && a.id === b.id;

export class InvalidLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidLinkError';
  }
}

async function findLink(a: ItemRef, b: ItemRef): Promise<Link | undefined> {
  const forward = await db.links
    .where('[fromType+fromId]')
    .equals([a.type, a.id])
    .filter((l) => l.toType === b.type && l.toId === b.id)
    .first();
  if (forward) return forward;
  return db.links
    .where('[fromType+fromId]')
    .equals([b.type, b.id])
    .filter((l) => l.toType === a.type && l.toId === a.id)
    .first();
}

export const linksRepo = {
  /** Links two items. Linking the same pair again returns the existing link. */
  async link(from: ItemRef, to: ItemRef): Promise<Link> {
    if (same(from, to)) throw new InvalidLinkError("An item can't be linked to itself");
    return db.transaction(
      'rw',
      [db.links, db.tasks, db.events, db.notes, db.documents],
      async () => {
        for (const ref of [from, to]) {
          const row = await tables[ref.type]().get(ref.id);
          if (!row) throw new EntityNotFoundError(ref.type, ref.id);
        }
        const existing = await findLink(from, to);
        if (existing) return existing;
        const now = clock.now();
        const link: Link = {
          id: uuidv7(now),
          fromType: from.type,
          fromId: from.id,
          toType: to.type,
          toId: to.id,
          createdAt: now,
        };
        await db.links.add(link);
        return link;
      },
    );
  },

  unlink: (linkId: string) => db.links.delete(linkId),

  /** Re-creates a removed link (for Undo). */
  restoreLink: (link: Link) => db.links.put(link),

  /** Everything linked to an item, from either direction, oldest first. */
  async linksOf(item: ItemRef): Promise<LinkedRef[]> {
    const [outgoing, incoming] = await Promise.all([
      db.links.where('[fromType+fromId]').equals([item.type, item.id]).toArray(),
      db.links.where('[toType+toId]').equals([item.type, item.id]).toArray(),
    ]);
    return [
      ...outgoing.map((l) => ({
        linkId: l.id,
        type: l.toType as LinkableType,
        id: l.toId,
        createdAt: l.createdAt,
      })),
      ...incoming.map((l) => ({
        linkId: l.id,
        type: l.fromType as LinkableType,
        id: l.fromId,
        createdAt: l.createdAt,
      })),
    ].sort((a, b) => a.createdAt - b.createdAt);
  },
};
