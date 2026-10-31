import { create } from 'zustand';

export type ImportStatus = 'waiting' | 'hashing' | 'saving' | 'done' | 'duplicate' | 'error';

export interface ImportItem {
  id: number;
  file: File;
  status: ImportStatus;
  /** 0–1 while hashing; null when unknown. */
  progress: number | null;
  folderId: string | null;
  tagIds: string[];
  error?: string;
  documentId?: string;
  /** Set when the same content is already in the library. */
  duplicate?: { hash: string; existingId: string; existingTitle: string };
  /** "Keep both" was chosen after a duplicate warning. */
  allowDuplicate?: boolean;
}

interface ImportState {
  items: ImportItem[];
  enqueue: (files: File[], target?: { folderId?: string | null; tagIds?: string[] }) => void;
  update: (id: number, patch: Partial<ImportItem>) => void;
  /** Import a duplicate anyway. */
  keepBoth: (id: number) => void;
  /** Drop one item (a skipped duplicate or a failed file). */
  dismiss: (id: number) => void;
  clearFinished: () => void;
}

let nextId = 1;

/** Starts the import runner. It's a separate download, fetched only when files arrive. */
const run = () => void import('./importRunner').then((m) => m.runImports());

/**
 * Files waiting to be imported or just imported. Holds File references only (the browser
 * reads the bytes from disk on demand), so 50 large files don't fill memory.
 */
export const useImportQueue = create<ImportState>((set, get) => ({
  items: [],
  enqueue: (files, target = {}) => {
    if (!files.length) return;
    const items = files.map<ImportItem>((file) => ({
      id: nextId++,
      file,
      status: 'waiting',
      progress: null,
      folderId: target.folderId ?? null,
      tagIds: target.tagIds ?? [],
    }));
    set((s) => ({ items: [...s.items, ...items] }));
    run();
  },
  update: (id, patch) =>
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
  keepBoth: (id) => {
    get().update(id, { status: 'waiting', allowDuplicate: true, progress: null });
    run();
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  clearFinished: () =>
    set((s) => ({
      items: s.items.filter(
        (i) => i.status === 'waiting' || i.status === 'hashing' || i.status === 'saving',
      ),
    })),
}));

export const isActive = (i: ImportItem) =>
  i.status === 'waiting' || i.status === 'hashing' || i.status === 'saving';
