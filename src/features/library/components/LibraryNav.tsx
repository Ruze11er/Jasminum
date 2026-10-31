import type { ReactNode } from 'react';
import {
  Clock,
  Files,
  Folder as FolderIcon,
  FolderPlus,
  FolderX,
  History,
  Star,
  TagIcon,
} from 'lucide-react';
import { IconButton } from '@/design-system';
import { chipColorClasses } from '@/design-system/components/chipColors';
import type { Folder } from '@/data/types';
import { folderColor } from '@/features/folders/folderColor';
import { cn } from '@/lib/cn';
import { moveDocument, useDocDrop } from '../moveDocument';
import type { LibraryView } from '../selectors';
import type { LibraryData } from '../useLibraryData';

export interface ViewItem {
  value: LibraryView;
  label: string;
  count: number;
}

const VIEW_ICONS: Partial<Record<LibraryView, ReactNode>> = {
  all: <Files />,
  recent: <Clock />,
  opened: <History />,
  favorites: <Star />,
  unfiled: <FolderX />,
  untagged: <TagIcon />,
};

const rowClasses =
  'flex h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-sm font-semibold transition-colors aria-pressed:bg-primary-soft aria-pressed:text-primary-soft-fg not-aria-pressed:text-fg-muted not-aria-pressed:hover:bg-surface-muted not-aria-pressed:hover:text-fg';

function Row({
  item,
  current,
  icon,
  onSelect,
  dropTarget,
}: {
  item: ViewItem;
  current: LibraryView;
  icon: ReactNode;
  onSelect: (v: LibraryView) => void;
  dropTarget?: { over: boolean; dropProps: object };
}) {
  return (
    <button
      type="button"
      aria-pressed={current === item.value}
      onClick={() => onSelect(item.value)}
      {...dropTarget?.dropProps}
      className={cn(rowClasses, dropTarget?.over && 'ring-2 ring-primary')}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      <span className="text-xs">{item.count}</span>
    </button>
  );
}

function FolderRow({
  folder,
  item,
  current,
  data,
  onSelect,
}: {
  folder: Folder;
  item: ViewItem;
  current: LibraryView;
  data: LibraryData;
  onSelect: (v: LibraryView) => void;
}) {
  const drop = useDocDrop((id) => {
    const doc = data.docs.find((d) => d.id === id);
    if (doc) void moveDocument(doc, folder);
  });
  return (
    <Row
      item={item}
      current={current}
      onSelect={onSelect}
      dropTarget={drop}
      icon={
        <span
          aria-hidden="true"
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-lg [&>svg]:size-3.5',
            chipColorClasses[folderColor(folder)],
          )}
        >
          <FolderIcon className="fill-current/20" />
        </span>
      }
    />
  );
}

function UnfiledRow(props: {
  item: ViewItem;
  current: LibraryView;
  data: LibraryData;
  onSelect: (v: LibraryView) => void;
}) {
  const drop = useDocDrop((id) => {
    const doc = props.data.docs.find((d) => d.id === id);
    if (doc) void moveDocument(doc, null);
  });
  return <Row {...props} dropTarget={drop} icon={<Icon view="unfiled" />} />;
}

const Icon = ({ view }: { view: LibraryView }) => (
  <span
    aria-hidden="true"
    className="flex size-6 shrink-0 items-center justify-center [&>svg]:size-4"
  >
    {VIEW_ICONS[view]}
  </span>
);

const SectionTitle = ({ children }: { children: ReactNode }) => (
  <h2 className="px-2.5 text-xs font-bold tracking-wide text-fg-muted uppercase">{children}</h2>
);

/** Wide screens: the library's sections, folders and clean-up views in a side column. */
export function LibrarySidebar({
  views,
  folders,
  current,
  data,
  onSelect,
  onNewFolder,
}: {
  views: ViewItem[];
  folders: { folder: Folder; item: ViewItem }[];
  current: LibraryView;
  data: LibraryData;
  onSelect: (v: LibraryView) => void;
  onNewFolder: () => void;
}) {
  const main = views.filter((v) => v.value !== 'unfiled' && v.value !== 'untagged');
  const tidy = views.filter((v) => v.value === 'unfiled' || v.value === 'untagged');
  return (
    <aside aria-label="Library sections" className="sticky top-6 space-y-5">
      <div role="group" aria-label="Show" className="space-y-0.5">
        {main.map((v) => (
          <Row
            key={v.value}
            item={v}
            current={current}
            onSelect={onSelect}
            icon={<Icon view={v.value} />}
          />
        ))}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <SectionTitle>Folders</SectionTitle>
          <IconButton
            label="New folder"
            icon={<FolderPlus />}
            onClick={onNewFolder}
            className="size-8 [&>svg]:size-4"
          />
        </div>
        {folders.length ? (
          <div role="group" aria-label="Folders" className="space-y-0.5">
            {folders.map(({ folder, item }) => (
              <FolderRow
                key={folder.id}
                folder={folder}
                item={item}
                current={current}
                data={data}
                onSelect={onSelect}
              />
            ))}
          </div>
        ) : (
          <p className="px-2.5 text-sm text-fg-muted">No folders yet.</p>
        )}
      </div>

      <div className="space-y-1">
        <SectionTitle>Tidy up</SectionTitle>
        <div role="group" aria-label="Tidy up" className="space-y-0.5">
          {tidy.map((v) =>
            v.value === 'unfiled' ? (
              <UnfiledRow
                key={v.value}
                item={v}
                current={current}
                data={data}
                onSelect={onSelect}
              />
            ) : (
              <Row
                key={v.value}
                item={v}
                current={current}
                onSelect={onSelect}
                icon={<Icon view={v.value} />}
              />
            ),
          )}
        </div>
      </div>
    </aside>
  );
}

/** Narrower screens: the same views as one scrollable row of chips. */
export function ViewChips({
  views,
  current,
  onSelect,
}: {
  views: ViewItem[];
  current: LibraryView;
  onSelect: (v: LibraryView) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Show"
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0"
    >
      {views.map((v) => (
        <button
          key={v.value}
          type="button"
          aria-pressed={current === v.value}
          onClick={() => onSelect(v.value)}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold whitespace-nowrap transition-colors aria-pressed:bg-primary aria-pressed:text-on-primary not-aria-pressed:bg-surface-muted not-aria-pressed:text-fg-muted not-aria-pressed:hover:text-fg max-md:h-10 [&_svg]:size-4"
        >
          <span aria-hidden="true">{VIEW_ICONS[v.value]}</span>
          {v.label}
          <span className="text-xs">{v.count}</span>
        </button>
      ))}
    </div>
  );
}
