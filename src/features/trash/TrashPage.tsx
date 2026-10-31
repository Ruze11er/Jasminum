import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { RotateCcw, Trash2 } from 'lucide-react';
import {
  BulkAction,
  Button,
  Card,
  Chip,
  ConfirmDialog,
  EmptyState,
  IconButton,
  PageHeader,
  SelectButton,
  SelectCheck,
  SelectionBar,
  toast,
} from '@/design-system';
import {
  deleteForever,
  emptyTrash,
  listTrash,
  restoreFromTrash,
  TRASH_RETENTION_DAYS,
  type TrashItem,
} from '@/data/trash';
import { clock } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/format';
import { useSelection } from '@/lib/useSelection';

const keyOf = (item: Pick<TrashItem, 'type' | 'id'>) => `${item.type}:${item.id}`;
const itemsLabel = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`;

export default function TrashPage() {
  const items = useLiveQuery(listTrash, []);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [toDelete, setToDelete] = useState<TrashItem | null>(null);
  const [confirmSelected, setConfirmSelected] = useState(false);
  const now = clock.now();
  const selection = useSelection((items ?? []).map(keyOf));
  const picked = (items ?? []).filter((i) => selection.ids.includes(keyOf(i)));

  const restoreSelected = async () => {
    for (const item of picked) await restoreFromTrash(item);
    toast({ message: `Restored ${itemsLabel(picked.length)}` });
    selection.exit();
  };

  const restore = async (item: TrashItem) => {
    await restoreFromTrash(item);
    toast({ message: `Restored "${item.title}"` });
  };

  return (
    <>
      <PageHeader
        title="Trash"
        subtitle={`Deleted items stay here for ${TRASH_RETENTION_DAYS} days, then they're erased for good.`}
        actions={
          items && items.length > 0 && !selection.active ? (
            <>
              <SelectButton selection={selection} />
              <Button variant="secondary" icon={<Trash2 />} onClick={() => setConfirmEmpty(true)}>
                Empty trash
              </Button>
            </>
          ) : undefined
        }
      />

      {selection.active && (
        <div className="mb-4">
          <SelectionBar selection={selection}>
            <BulkAction
              icon={<RotateCcw />}
              label="Restore"
              disabled={!picked.length}
              onClick={() => void restoreSelected()}
            />
            <BulkAction
              icon={<Trash2 />}
              label="Delete forever"
              variant="danger"
              disabled={!picked.length}
              onClick={() => setConfirmSelected(true)}
            />
          </SelectionBar>
        </div>
      )}

      <Card className="p-0 md:p-0">
        {items === undefined ? null : items.length === 0 ? (
          <EmptyState
            icon={<Trash2 />}
            title="Trash is empty"
            description="Anything you delete lands here first, so you can change your mind."
          />
        ) : (
          <ul aria-label="Deleted items" className="divide-y divide-line">
            {items.map((item) => {
              const details = (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Chip color="neutral" className="h-6 text-xs">
                      {item.label}
                    </Chip>
                    <p className="truncate font-semibold">{item.title}</p>
                  </div>
                  <p className="mt-0.5 text-sm text-fg-muted">
                    Deleted {formatRelative(item.deletedAt, now)} · erased{' '}
                    {formatRelative(item.expiresAt, now)}
                  </p>
                </div>
              );
              if (selection.active) {
                const selected = selection.isSelected(keyOf(item));
                return (
                  <li key={keyOf(item)}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={(e) => selection.toggle(keyOf(item), e.shiftKey)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors md:px-5',
                        selected ? 'bg-primary-soft/60' : 'hover:bg-surface-muted',
                      )}
                    >
                      <SelectCheck checked={selected} />
                      {details}
                    </button>
                  </li>
                );
              }
              return (
                <li key={keyOf(item)} className="flex items-center gap-3 px-4 py-3 md:px-5">
                  {details}
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<RotateCcw />}
                    onClick={() => restore(item)}
                  >
                    Restore
                  </Button>
                  <IconButton
                    label={`Delete "${item.title}" forever`}
                    icon={<Trash2 />}
                    onClick={() => setToDelete(item)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={confirmEmpty}
        onOpenChange={setConfirmEmpty}
        title="Empty the trash?"
        description={`${items?.length ?? 0} item(s) will be erased for good. This can't be undone.`}
        confirmLabel="Erase everything"
        onConfirm={async () => {
          const n = await emptyTrash();
          toast({ message: `Erased ${n} item(s)` });
        }}
      />
      <ConfirmDialog
        open={confirmSelected}
        onOpenChange={setConfirmSelected}
        title="Delete forever?"
        description={`${itemsLabel(picked.length)} will be erased for good. This can't be undone.`}
        confirmLabel="Delete forever"
        onConfirm={async () => {
          for (const item of picked) await deleteForever(item);
          toast({ message: `Deleted ${itemsLabel(picked.length)} forever` });
          selection.exit();
        }}
      />
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete forever?"
        description={
          toDelete ? `"${toDelete.title}" will be erased for good. This can't be undone.` : ''
        }
        confirmLabel="Delete forever"
        onConfirm={async () => {
          if (!toDelete) return;
          await deleteForever(toDelete);
          toast({ message: 'Deleted forever' });
        }}
      />
    </>
  );
}
