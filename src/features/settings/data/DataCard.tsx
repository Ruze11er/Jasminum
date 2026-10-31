import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  ChevronRight,
  Database,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button, Card, CardHeader, ConfirmDialog, toast } from '@/design-system';
import { useSetting } from '@/data/repos/settings';
import { clock } from '@/lib/clock';
import { formatRelative } from '@/lib/format';
import { downloadFile } from '@/platform/share';
import { FilePickerButton } from '@/features/library/components/FilePickerButton';

// Backup, restore and the integrity check pull in zip and crypto code: loaded on first use.
const BackupDialog = lazy(() => import('./BackupDialog'));
const RestoreDialog = lazy(() => import('./RestoreDialog'));
const IntegrityDialog = lazy(() => import('./IntegrityDialog'));

type Open = null | 'backup' | 'integrity' | { restore: File };

const secondaryClasses =
  'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary-soft px-3 text-sm font-semibold whitespace-nowrap text-primary-soft-fg transition-colors hover:bg-primary-soft-hover max-md:h-11 [&_svg]:size-[1.15em]';

function Row({ title, text, children }: { title: string; text: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1 basis-60">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-fg-muted">{text}</p>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/** Settings → Backup & data: back up, restore, undo a restore, exports, integrity, Trash. */
export function DataCard() {
  const lastBackupAt = useSetting('lastBackupAt');
  const [open, setOpen] = useState<Open>(null);
  const [snapshot, setSnapshot] = useState<{ key: string; at: number } | null>(null);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void import('@/data/backup/snapshots')
      .then((m) => m.listSnapshots())
      .then((list) => !cancelled && setSnapshot(list[0] ?? null))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const exportNotes = async () => {
    const { exportNotesZip } = await import('@/data/export/markdown');
    const { blob, count } = await exportNotesZip();
    downloadFile(blob, 'jasminum-notes.zip');
    toast({ message: `${count} ${count === 1 ? 'note' : 'notes'} exported` });
  };
  const exportTasks = async () => {
    const { exportTasksCsv } = await import('@/data/export/csv');
    const { blob, count } = await exportTasksCsv();
    downloadFile(blob, 'jasminum-tasks.csv');
    toast({ message: `${count} ${count === 1 ? 'task' : 'tasks'} exported` });
  };
  const undoRestore = async () => {
    if (!snapshot) return;
    const { restoreSnapshot } = await import('@/data/backup/snapshots');
    await restoreSnapshot(snapshot.key);
    toast({ message: 'Your data is back to how it was before the restore' });
    setRefresh((n) => n + 1);
  };

  return (
    <Card id="data">
      <CardHeader title="Backup & data" icon={<Database />} />
      <div className="divide-y divide-line">
        <Row
          title="Backup"
          text={
            lastBackupAt
              ? `Last backup ${formatRelative(lastBackupAt, clock.now())}.`
              : 'No backup yet. A backup is the only way to move your data to another device, or get it back if the browser clears it.'
          }
        >
          <Button size="sm" icon={<ShieldCheck />} onClick={() => setOpen('backup')}>
            Back up now
          </Button>
        </Row>

        <Row title="Restore" text="Bring back data from a Jasminum backup file.">
          {/* No `accept` filter: iOS greys out files with unknown extensions like
              .jasminum. The contents are checked on restore anyway. */}
          <FilePickerButton
            multiple={false}
            className={secondaryClasses}
            onFiles={([file]) => file && setOpen({ restore: file })}
          >
            <Upload aria-hidden="true" />
            Restore from file
          </FilePickerButton>
          {snapshot && (
            <Button
              variant="ghost"
              size="sm"
              icon={<RotateCcw />}
              onClick={() => setConfirmUndo(true)}
            >
              Undo last restore
            </Button>
          )}
        </Row>

        <Row title="Export" text="Readable copies for other apps. Not a backup.">
          <Button
            variant="secondary"
            size="sm"
            icon={<FileText />}
            onClick={() => void exportNotes()}
          >
            Notes (Markdown)
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<FileSpreadsheet />}
            onClick={() => void exportTasks()}
          >
            Tasks (CSV)
          </Button>
        </Row>

        <Row title="Check for problems" text="Finds missing files, wasted space and broken links.">
          <Button variant="secondary" size="sm" onClick={() => setOpen('integrity')}>
            Check now
          </Button>
        </Row>

        <div className="pt-2">
          <Link
            to="/trash"
            className="flex items-center gap-3 rounded-xl px-1 py-2.5 font-semibold hover:text-link"
          >
            <Trash2 className="size-5 text-fg-muted" aria-hidden="true" />
            <span className="flex-1">Trash</span>
            <ChevronRight className="size-4 text-fg-muted" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <Suspense fallback={null}>
        {open === 'backup' && <BackupDialog onClose={() => setOpen(null)} />}
        {open === 'integrity' && <IntegrityDialog onClose={() => setOpen(null)} />}
        {open && typeof open === 'object' && (
          <RestoreDialog
            file={open.restore}
            onClose={() => {
              setOpen(null);
              setRefresh((n) => n + 1);
            }}
          />
        )}
      </Suspense>

      <ConfirmDialog
        open={confirmUndo}
        onOpenChange={setConfirmUndo}
        title="Undo the last restore?"
        description={
          snapshot
            ? `Your data goes back to how it was on ${new Date(snapshot.at).toLocaleString()}, just before the restore. Changes made since then are lost.`
            : ''
        }
        confirmLabel="Undo restore"
        onConfirm={() => void undoRestore()}
      />
    </Card>
  );
}
