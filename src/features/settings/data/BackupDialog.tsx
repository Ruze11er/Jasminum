import { useState } from 'react';
import { Download, HardDriveDownload, Share2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Button, Checkbox, Field, Input, Sheet, toast } from '@/design-system';
import { backupFileName } from '@/data/backup/format';
import { createBackupBlob, writeBackup, type BackupSummary } from '@/data/backup/exportBackup';
import { clock } from '@/lib/clock';
import { formatBytes } from '@/lib/format';
import { canShareFiles, downloadFile, shareFile } from '@/platform/share';

const MIN_PASSPHRASE = 8;

type SaveFilePicker = (options: {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<FileSystemFileHandle>;

/** "Save as…" streams straight to disk where the browser allows it (desktop Chromium). */
const savePicker = (): SaveFilePicker | null =>
  typeof window !== 'undefined' && 'showSaveFilePicker' in window
    ? (window as unknown as { showSaveFilePicker: SaveFilePicker }).showSaveFilePicker
    : null;

const describe = (s: BackupSummary) => {
  const parts = [
    [s.counts.tasks, 'task'],
    [s.counts.events, 'event'],
    [s.counts.notes, 'note'],
    [s.counts.documents, 'file'],
  ]
    .filter(([n]) => n)
    .map(([n, word]) => `${n} ${word}${n === 1 ? '' : 's'}`);
  return parts.length ? parts.join(', ') : 'Settings only';
};

/** Make a backup: optional passphrase, then Download, Share or Save as…. */
export default function BackupDialog({ onClose }: { onClose: () => void }) {
  const [protect, setProtect] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string>();
  const [progress, setProgress] = useState<number | null>(null);
  const [ready, setReady] = useState<{ file: File; summary: BackupSummary } | null>(null);
  const working = progress !== null;

  const options = () => {
    if (!protect) return {};
    if (passphrase.length < MIN_PASSPHRASE) {
      throw new Error(`Use a passphrase of at least ${MIN_PASSPHRASE} characters.`);
    }
    if (passphrase !== confirm) throw new Error("The passphrases don't match.");
    return { passphrase };
  };
  const onProgress = (done: number, total: number) => setProgress(total ? done / total : 1);

  const create = async () => {
    setError(undefined);
    try {
      const opts = options();
      setProgress(0);
      const { blob, summary } = await createBackupBlob({ ...opts, onProgress });
      setReady({ file: new File([blob], backupFileName(new Date(clock.now()))), summary });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the backup.");
    } finally {
      setProgress(null);
    }
  };

  const saveAs = async () => {
    setError(undefined);
    let opts;
    try {
      opts = options();
    } catch (err) {
      setError((err as Error).message);
      return;
    }
    // The picker must open straight from the click, before any other waiting.
    let handle: FileSystemFileHandle;
    try {
      handle = await savePicker()!({
        suggestedName: backupFileName(new Date(clock.now())),
        types: [
          { description: 'Jasminum backup', accept: { 'application/octet-stream': ['.jasminum'] } },
        ],
      });
    } catch {
      return; // cancelled
    }
    setProgress(0);
    const writable = await handle.createWritable();
    try {
      const summary = await writeBackup((chunk) => writable.write(chunk as BufferSource), {
        ...opts,
        onProgress,
      });
      await writable.close();
      toast({ message: `Backup saved · ${describe(summary)}` });
      onClose();
    } catch (err) {
      await writable.abort().catch(() => undefined);
      setError(err instanceof Error ? err.message : "Couldn't save the backup.");
    } finally {
      setProgress(null);
    }
  };

  return (
    <Sheet open onOpenChange={(o) => !o && !working && onClose()} title="Back up your data">
      <div className="space-y-4 pb-2">
        {ready ? (
          <>
            <div className="rounded-xl bg-success-soft p-4">
              <p className="font-semibold">Backup ready · {formatBytes(ready.file.size)}</p>
              <p className="text-sm">{describe(ready.summary)}</p>
            </div>
            <p className="text-sm text-fg-muted">
              Keep it somewhere safe that isn't this browser: cloud storage, email to yourself, or a
              USB drive.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                icon={<Download />}
                onClick={() => {
                  downloadFile(ready.file, ready.file.name);
                  toast({ message: 'Backup downloaded' });
                  onClose();
                }}
              >
                Download backup
              </Button>
              {canShareFiles(ready.file) && (
                <Button
                  variant="secondary"
                  icon={<Share2 />}
                  onClick={() =>
                    void shareFile(ready.file, 'Jasminum backup').then(
                      (r) => r === 'shared' && onClose(),
                      () => toast({ tone: 'error', message: "Couldn't share the backup" }),
                    )
                  }
                >
                  Share backup
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-fg-muted">
              Everything goes into one file: tasks, events, notes, files and settings, including the
              Trash.
            </p>
            <Checkbox
              label="Protect with a passphrase"
              checked={protect}
              disabled={working}
              onChange={(e) => setProtect(e.target.checked)}
            />
            {protect && (
              <div className="space-y-3 rounded-xl bg-surface-muted p-3">
                <Field label="Passphrase" hint={`At least ${MIN_PASSPHRASE} characters.`}>
                  {(p) => (
                    <Input
                      {...p}
                      type="password"
                      autoComplete="new-password"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                    />
                  )}
                </Field>
                <Field label="Type it again">
                  {(p) => (
                    <Input
                      {...p}
                      type="password"
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                  )}
                </Field>
                {/* Amber only on the icon: amber text on this background fails contrast. */}
                <p className="flex gap-2 text-sm font-semibold text-fg">
                  <TriangleAlert
                    className="mt-0.5 size-4 shrink-0 text-warning"
                    aria-hidden="true"
                  />
                  If you forget the passphrase, the backup can't be opened. Nobody can recover it.
                </p>
              </div>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-semibold text-danger"
              >
                {error}
              </p>
            )}
            {working && (
              <div aria-live="polite" className="space-y-1.5">
                <p className="text-sm font-semibold">
                  Creating backup… {Math.round(progress * 100)}%
                </p>
                <progress
                  aria-label="Backup progress"
                  max={1}
                  value={progress}
                  className="h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-surface-muted [&::-webkit-progress-value]:bg-primary"
                />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button icon={<ShieldCheck />} disabled={working} onClick={() => void create()}>
                Create backup
              </Button>
              {savePicker() && (
                <Button
                  variant="secondary"
                  icon={<HardDriveDownload />}
                  disabled={working}
                  onClick={() => void saveAs()}
                >
                  Save as…
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
