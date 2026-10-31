import { useEffect, useId, useRef, useState } from 'react';
import { CircleAlert, Loader2 } from 'lucide-react';
import { Button, Field, Input, Sheet, toast } from '@/design-system';
import { BackupError } from '@/data/backup/format';
import {
  applyBackup,
  discardStaged,
  readBackup,
  type RestoreMode,
  type StagedBackup,
} from '@/data/backup/restore';
import { restoreSnapshot } from '@/data/backup/snapshots';
import { cn } from '@/lib/cn';

type Phase = 'checking' | 'passphrase' | 'review' | 'applying' | 'error';

const COUNTS: [string, string, string][] = [
  ['tasks', 'task', 'tasks'],
  ['events', 'event', 'events'],
  ['notes', 'note', 'notes'],
  ['documents', 'file', 'files'],
  ['categories', 'category', 'categories'],
  ['tags', 'tag', 'tags'],
];

/** Restore a backup file: check it, ask for the passphrase if needed, then merge or replace. */
export default function RestoreDialog({ file, onClose }: { file: File; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('checking');
  const [error, setError] = useState<string>();
  const [passphrase, setPassphrase] = useState('');
  const [staged, setStaged] = useState<StagedBackup | null>(null);
  const [mode, setMode] = useState<RestoreMode>('merge');
  const applied = useRef(false);
  const modeName = useId();

  const read = async (pass?: string) => {
    setPhase('checking');
    setError(undefined);
    try {
      setStaged(await readBackup(file, pass));
      setPhase('review');
    } catch (err) {
      if (
        err instanceof BackupError &&
        (err.reason === 'needs-passphrase' || err.reason === 'wrong-passphrase')
      ) {
        setPhase('passphrase');
        if (err.reason === 'wrong-passphrase') setError('Wrong passphrase. Try again.');
        return;
      }
      setPhase('error');
      setError(err instanceof Error ? err.message : "Couldn't read this file.");
    }
  };

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void read();
    // Runs once for the chosen file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    // File bytes read from a backup that wasn't applied are cleaned up again.
    if (staged && !applied.current) void discardStaged(staged);
    onClose();
  };

  const apply = async () => {
    if (!staged) return;
    setPhase('applying');
    try {
      const result = await applyBackup(staged, mode);
      applied.current = true;
      toast({
        message:
          result.filesMissing > 0
            ? `Backup restored. ${result.filesMissing} file(s) couldn't be recovered.`
            : 'Backup restored',
        tone: result.filesMissing > 0 ? 'info' : 'success',
        action: { label: 'Undo', onClick: () => void restoreSnapshot(result.snapshotKey) },
      });
      onClose();
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : "Couldn't restore the backup.");
    }
  };

  const m = staged?.manifest;
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && phase !== 'applying' && close()}
      title="Restore from backup"
      description={file.name}
    >
      <div className="space-y-4 pb-2">
        {(phase === 'checking' || phase === 'applying') && (
          <p aria-live="polite" className="flex items-center gap-2 py-6 font-semibold">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
            {phase === 'checking' ? 'Checking the backup…' : 'Restoring…'}
          </p>
        )}

        {phase === 'error' && (
          <>
            <p
              role="alert"
              className="flex gap-2 rounded-xl bg-danger-soft p-3 font-semibold text-danger"
            >
              <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              {error}
            </p>
            <p className="text-sm text-fg-muted">Nothing on this device was changed.</p>
            <Button variant="ghost" onClick={close}>
              Close
            </Button>
          </>
        )}

        {phase === 'passphrase' && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void read(passphrase);
            }}
          >
            <p className="text-fg-muted">This backup is protected. Enter its passphrase.</p>
            <Field label="Passphrase" error={error}>
              {(p) => (
                <Input
                  {...p}
                  autoFocus
                  type="password"
                  autoComplete="current-password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                />
              )}
            </Field>
            <Button type="submit" disabled={!passphrase}>
              Unlock
            </Button>
          </form>
        )}

        {phase === 'review' && m && staged && (
          <>
            <div className="rounded-xl bg-surface-muted p-4">
              <p className="font-semibold">
                Backup from{' '}
                {new Date(m.createdAt).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
              <p className="text-sm text-fg-muted">
                {COUNTS.filter(([key]) => m.counts[key])
                  .map(([key, one, many]) => `${m.counts[key]} ${m.counts[key] === 1 ? one : many}`)
                  .join(' · ') || 'No items'}
              </p>
            </div>
            {staged.filesMissing.length > 0 && (
              <p className="rounded-xl bg-warning-soft p-3 text-sm font-semibold text-fg">
                {staged.filesMissing.length} file(s) in this backup are missing or damaged.
                Everything else can still be restored; those files will be marked as missing.
              </p>
            )}
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-semibold">How should it be restored?</legend>
              {(
                [
                  [
                    'merge',
                    'Merge with what’s here',
                    'Adds what’s missing. Where both have an item, the newer change wins.',
                  ],
                  ['replace', 'Replace everything', 'This device ends up exactly like the backup.'],
                ] as const
              ).map(([value, label, hint]) => (
                <label
                  key={value}
                  className={cn(
                    'flex cursor-pointer gap-3 rounded-xl border-[1.5px] p-3',
                    mode === value ? 'border-brand bg-primary-soft/40' : 'border-line',
                  )}
                >
                  <input
                    type="radio"
                    name={modeName}
                    value={value}
                    checked={mode === value}
                    onChange={() => setMode(value)}
                    className="mt-1 size-4 accent-[var(--primary)]"
                  />
                  <span>
                    <span className="block font-semibold">{label}</span>
                    <span className="block text-sm text-fg-muted">{hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <p className="text-sm text-fg-muted">
              A copy of your current data is kept, so you can undo this restore.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button
                variant={mode === 'replace' ? 'danger' : 'primary'}
                onClick={() => void apply()}
              >
                {mode === 'replace' ? 'Replace everything' : 'Restore'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
