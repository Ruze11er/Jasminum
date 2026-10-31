import { useState } from 'react';
import { Folder as FolderIcon, FolderPlus } from 'lucide-react';
import { Button } from '@/design-system';
import { chipColorClasses } from '@/design-system/components/chipColors';
import type { Folder } from '@/data/types';
import { createFolder } from '@/features/folders/folderActions';
import { folderColor } from '@/features/folders/folderColor';
import { cn } from '@/lib/cn';
import { formatBytes } from '@/lib/format';
import { moveDocument, useDocDrop } from '../moveDocument';
import { filesLabel } from '../selectors';
import type { LibraryData } from '../useLibraryData';

/** One folder as a colored tile. Click to open it; drop a file card on it to move the file. */
function FolderTile({
  folder,
  count,
  size,
  data,
  onOpen,
}: {
  folder: Folder;
  count: number;
  size: number;
  data: LibraryData;
  onOpen: () => void;
}) {
  const { over, dropProps } = useDocDrop((id) => {
    const doc = data.docs.find((d) => d.id === id);
    if (doc) void moveDocument(doc, folder);
  });
  return (
    <button
      type="button"
      onClick={onOpen}
      {...dropProps}
      className={cn(
        'flex h-full w-full flex-col items-start gap-3 rounded-2xl p-3.5 text-left shadow-soft-sm transition-[box-shadow,transform] duration-200',
        'hover:-translate-y-0.5 hover:shadow-soft-lg',
        chipColorClasses[folderColor(folder)],
        over && 'ring-3 ring-primary',
      )}
    >
      <FolderIcon aria-hidden="true" className="size-8 fill-current/15" strokeWidth={1.75} />
      <span className="w-full min-w-0">
        <span className="block truncate font-bold">{folder.name}</span>
        <span className="block truncate text-xs font-semibold">
          {count ? `${filesLabel(count)} · ${formatBytes(size)}` : 'Empty'}
        </span>
      </span>
    </button>
  );
}

/** The "New folder" tile; it turns into a name field. */
function NewFolderTile({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (f: Folder) => void;
}) {
  const [name, setName] = useState('');
  const shell =
    'flex h-full min-h-[6.5rem] w-full rounded-2xl border-2 border-dashed border-line-strong';
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className={cn(
          shell,
          'flex-col items-start justify-between p-3.5 text-left font-semibold text-fg-muted transition-colors hover:border-primary hover:text-primary-soft-fg',
        )}
      >
        <FolderPlus aria-hidden="true" className="size-8" strokeWidth={1.75} />
        New folder
      </button>
    );
  }
  return (
    <form
      className={cn(shell, 'flex-col justify-between gap-2 border-primary p-2.5')}
      onSubmit={(e) => {
        e.preventDefault();
        void createFolder('documents', name).then((f) => {
          if (!f) return;
          setName('');
          onOpenChange(false);
          onCreated(f);
        });
      }}
    >
      <label htmlFor="new-folder" className="sr-only">
        New folder name
      </label>
      <input
        id="new-folder"
        autoFocus
        value={name}
        maxLength={40}
        placeholder="Folder name"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onOpenChange(false)}
        className="h-10 w-full rounded-xl border-[1.5px] border-line bg-surface px-3 outline-none focus:border-brand"
      />
      <span className="flex gap-1.5">
        <Button type="submit" size="sm" className="flex-1">
          Create
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
      </span>
    </form>
  );
}

/** The library's folders as big colored tiles, plus a tile to make a new one. */
export function FolderGrid({
  folders,
  data,
  counts,
  sizes,
  creating,
  onCreatingChange,
  onOpen,
  searching,
}: {
  folders: Folder[];
  data: LibraryData;
  counts: Map<string, number>;
  sizes: Map<string, number>;
  creating: boolean;
  onCreatingChange: (open: boolean) => void;
  onOpen: (folder: Folder) => void;
  /** While searching, only matching folders show and there's no "New folder" tile. */
  searching: boolean;
}) {
  if (searching && !folders.length) return null;
  return (
    <section aria-labelledby="folders-heading">
      <h2 id="folders-heading" className="mb-2.5 flex items-baseline gap-2 text-base">
        Folders
        {folders.length > 0 && (
          <span className="text-sm font-semibold text-fg-muted">{folders.length}</span>
        )}
      </h2>
      <ul aria-label="Folders" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {folders.map((f) => (
          <li key={f.id} className="min-w-0">
            <FolderTile
              folder={f}
              count={counts.get(f.id) ?? 0}
              size={sizes.get(f.id) ?? 0}
              data={data}
              onOpen={() => onOpen(f)}
            />
          </li>
        ))}
        {!searching && (
          <li className="min-w-0">
            <NewFolderTile open={creating} onOpenChange={onCreatingChange} onCreated={onOpen} />
          </li>
        )}
      </ul>
    </section>
  );
}
