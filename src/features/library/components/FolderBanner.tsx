import { useState } from 'react';
import { Check, ChevronLeft, FolderOpen, Palette, Pencil, Trash2 } from 'lucide-react';
import { Button, IconButton, Input } from '@/design-system';
import { chipColorClasses } from '@/design-system/components/chipColors';
import type { Folder } from '@/data/types';
import { deleteFolder, renameFolder, setFolderColor } from '@/features/folders/folderActions';
import { FOLDER_COLOR_LABELS, FOLDER_COLORS, folderColor } from '@/features/folders/folderColor';
import { cn } from '@/lib/cn';
import { formatBytes } from '@/lib/format';
import { filesLabel } from '../selectors';

const actionClasses = 'text-current hover:bg-surface/60 hover:text-current';

/** The open folder: a path back to the library, its name and size, and its settings. */
export function FolderBanner({
  folder,
  count,
  size,
  onBack,
}: {
  folder: Folder;
  count: number;
  size: number;
  onBack: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [picking, setPicking] = useState(false);
  const [name, setName] = useState(folder.name);
  const color = folderColor(folder);

  return (
    <div className="space-y-2">
      <nav aria-label="Breadcrumb">
        <ol className="flex min-w-0 items-center gap-1 text-sm font-semibold text-fg-muted">
          <li>
            <button
              type="button"
              onClick={onBack}
              className="-ml-1 flex items-center gap-0.5 rounded-lg px-1 py-1 hover:text-fg max-md:min-h-11"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
              Library
            </button>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="min-w-0 truncate text-fg">
            {folder.name}
          </li>
        </ol>
      </nav>

      <div className={cn('rounded-2xl p-3.5 md:p-4', chipColorClasses[color])}>
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface/55">
            <FolderOpen aria-hidden="true" className="size-6" strokeWidth={1.75} />
          </span>
          {renaming ? (
            <form
              className="flex min-w-0 flex-1 items-center gap-2"
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
          ) : (
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl">{folder.name}</h2>
              <p className="text-sm font-semibold">
                {count ? `${filesLabel(count)} · ${formatBytes(size)}` : 'Empty'}
              </p>
            </div>
          )}
          {!renaming && (
            <div className="flex shrink-0">
              <IconButton
                label="Rename folder"
                icon={<Pencil />}
                className={actionClasses}
                onClick={() => {
                  setName(folder.name);
                  setPicking(false);
                  setRenaming(true);
                }}
              />
              <IconButton
                label="Folder color"
                icon={<Palette />}
                aria-expanded={picking}
                className={actionClasses}
                onClick={() => setPicking((p) => !p)}
              />
              <IconButton
                label="Delete folder"
                icon={<Trash2 />}
                className={actionClasses}
                onClick={() => {
                  onBack();
                  void deleteFolder(folder);
                }}
              />
            </div>
          )}
        </div>

        {picking && (
          <div role="group" aria-label="Folder color" className="mt-3 flex flex-wrap gap-2">
            {FOLDER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={FOLDER_COLOR_LABELS[c]}
                aria-pressed={c === color}
                title={FOLDER_COLOR_LABELS[c]}
                onClick={() => void setFolderColor(folder, c)}
                className={cn(
                  'flex size-9 items-center justify-center rounded-full border-2 border-surface shadow-soft-sm max-md:size-11',
                  chipColorClasses[c],
                  c === color && 'ring-2 ring-current',
                )}
              >
                {c === color && <Check aria-hidden="true" className="size-4" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
