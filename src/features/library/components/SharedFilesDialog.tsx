import { useState } from 'react';
import { Button, Sheet, toast } from '@/design-system';
import { formatBytes } from '@/lib/format';
import { useImportQueue } from '../importStore';
import { discardSharedFiles, takeSharedFiles, type SharedFileInfo } from '../sharedFiles';

const SHOWN = 8;

/**
 * Asks before adding files that were shared into the app. Closing it decides nothing:
 * the files wait, and the question comes back the next time the Library opens.
 */
export function SharedFilesDialog({
  files,
  onClose,
}: {
  files: SharedFileInfo[];
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const one = files.length === 1;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
      onClose();
    }
  };

  const add = () =>
    run(async () => {
      const taken = await takeSharedFiles();
      if (taken.length) useImportQueue.getState().enqueue(taken);
    });

  const discard = () =>
    run(async () => {
      await discardSharedFiles();
      toast({ message: one ? 'Shared file discarded' : 'Shared files discarded' });
    });

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && !busy && onClose()}
      title={one ? 'Add a shared file?' : `Add ${files.length} shared files?`}
      description={`${one ? 'This file was' : 'These files were'} sent to Jasminum. Add ${one ? 'it' : 'them'} only if you shared ${one ? 'it' : 'them'} yourself.`}
    >
      <ul className="space-y-1.5 rounded-xl bg-surface-muted p-3 text-sm">
        {files.slice(0, SHOWN).map((f, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span className="min-w-0 truncate font-semibold">{f.name}</span>
            <span className="shrink-0 text-fg-muted">{formatBytes(f.size)}</span>
          </li>
        ))}
        {files.length > SHOWN && <li className="text-fg-muted">and {files.length - SHOWN} more</li>}
      </ul>
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" disabled={busy} onClick={() => void discard()}>
          Discard
        </Button>
        <Button disabled={busy} onClick={() => void add()}>
          Add to Library
        </Button>
      </div>
    </Sheet>
  );
}
