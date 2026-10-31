import { useState } from 'react';
import { FolderPlus, Pencil, Trash2 } from 'lucide-react';
import { Button, IconButton, Input } from '@/design-system';
import type { Folder, FolderScope } from '@/data/types';
import { createFolder, deleteFolder, renameFolder } from './folderActions';

/** Folder controls shared by Notes and the Library: "+ Folder", rename and delete. */

export function NewFolderButton({
  scope,
  onCreated,
}: {
  scope: FolderScope;
  onCreated: (f: Folder) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const submit = async () => {
    const folder = await createFolder(scope, name);
    if (folder) {
      setEditing(false);
      setName('');
      onCreated(folder);
    }
  };
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3 text-sm font-semibold whitespace-nowrap text-fg-muted hover:text-fg max-md:h-10"
      >
        <FolderPlus className="size-4" aria-hidden="true" />
        Folder
      </button>
    );
  }
  return (
    <form
      className="flex shrink-0 items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
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
        onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
        className="h-8 w-36 rounded-full border-[1.5px] border-line bg-surface px-3 text-sm outline-none focus:border-brand max-md:h-10"
      />
      <Button type="submit" size="sm">
        Add
      </Button>
    </form>
  );
}

export function FolderHeader({ folder, onDeleted }: { folder: Folder; onDeleted: () => void }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(folder.name);
  if (renaming) {
    return (
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void renameFolder(folder, name).then((ok) => ok && setRenaming(false));
        }}
      >
        <label htmlFor="rename-folder" className="sr-only">
          Folder name
        </label>
        <Input
          id="rename-folder"
          autoFocus
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setRenaming(false)}
        />
        <Button type="submit" size="sm">
          Save
        </Button>
      </form>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <h2 className="min-w-0 flex-1 truncate text-lg">{folder.name}</h2>
      <IconButton
        label="Rename folder"
        icon={<Pencil />}
        onClick={() => {
          setName(folder.name);
          setRenaming(true);
        }}
      />
      <IconButton
        label="Delete folder"
        icon={<Trash2 />}
        onClick={() => {
          onDeleted();
          void deleteFolder(folder);
        }}
      />
    </div>
  );
}
