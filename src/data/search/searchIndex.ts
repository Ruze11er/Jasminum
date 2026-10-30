import MiniSearch, { type SearchResult } from 'minisearch';
import type { EntityType } from '../types';

export interface SearchDoc {
  /** `${type}:${id}`, unique across all entity types. */
  key: string;
  type: EntityType;
  id: string;
  title: string;
  body?: string;
  tags?: string;
}

export type SearchFields = Pick<SearchDoc, 'title' | 'body' | 'tags'>;

export interface SearchHit {
  type: EntityType;
  id: string;
  title: string;
  score: number;
}

type Op = { kind: 'upsert'; doc: SearchDoc } | { kind: 'remove'; key: string };

const createMini = () =>
  new MiniSearch<SearchDoc>({
    idField: 'key',
    fields: ['title', 'body', 'tags'],
    storeFields: ['type', 'id', 'title'],
    searchOptions: { boost: { title: 3, tags: 2 }, prefix: true, fuzzy: 0.2 },
  });

export const searchKey = (type: EntityType, id: string) => `${type}:${id}`;

/**
 * In-memory full-text index over tasks, notes, documents and tags. It is rebuilt from
 * the database on startup and kept current by the repositories, which call
 * upsert/remove after each write.
 */
class SearchIndex {
  private mini = createMini();
  private sources = new Map<EntityType, () => Promise<SearchDoc[]>>();
  private pending: Op[] | null = null; // ops that arrive while a rebuild is running

  /** Each repository registers how to load its searchable records. */
  registerSource(type: EntityType, load: () => Promise<SearchDoc[]>) {
    this.sources.set(type, load);
  }

  upsert(doc: SearchDoc) {
    this.pending?.push({ kind: 'upsert', doc });
    this.apply({ kind: 'upsert', doc });
  }

  remove(type: EntityType, id: string) {
    const key = searchKey(type, id);
    this.pending?.push({ kind: 'remove', key });
    this.apply({ kind: 'remove', key });
  }

  /** Rebuilds from all sources, then swaps in the new index atomically. */
  async rebuild() {
    this.pending = [];
    try {
      const next = createMini();
      for (const load of this.sources.values()) next.addAll(await load());
      // Replay writes that happened while we were loading.
      for (const op of this.pending) SearchIndex.applyTo(next, op);
      this.mini = next;
    } finally {
      this.pending = null;
    }
  }

  search(query: string, options?: { types?: EntityType[]; limit?: number }): SearchHit[] {
    const q = query.trim();
    if (!q) return [];
    const types = options?.types;
    const results = this.mini.search(q, {
      filter: types ? (r: SearchResult) => types.includes(r.type as EntityType) : undefined,
    });
    return results.slice(0, options?.limit ?? 50).map((r) => ({
      type: r.type as EntityType,
      id: r.id as string,
      title: r.title as string,
      score: r.score,
    }));
  }

  get size() {
    return this.mini.documentCount;
  }

  /** Test helper: empties the index but keeps the registered sources. */
  resetForTests() {
    this.mini = createMini();
    this.pending = null;
  }

  private apply(op: Op) {
    SearchIndex.applyTo(this.mini, op);
  }

  private static applyTo(mini: MiniSearch<SearchDoc>, op: Op) {
    if (op.kind === 'upsert') {
      if (mini.has(op.doc.key)) mini.replace(op.doc);
      else mini.add(op.doc);
    } else if (mini.has(op.key)) {
      mini.discard(op.key);
    }
  }
}

export const searchIndex = new SearchIndex();
