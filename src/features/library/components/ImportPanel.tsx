import { CheckCircle2, CircleAlert, Copy, Loader2, X } from 'lucide-react';
import { Button } from '@/design-system';
import { formatBytes } from '@/lib/format';
import { isActive, useImportQueue, type ImportItem } from '../importStore';

const STAGE: Partial<Record<ImportItem['status'], string>> = {
  waiting: 'Waiting',
  hashing: 'Checking',
  saving: 'Saving',
};

/** Progress for files being added, plus duplicate warnings and errors to act on. */
export function ImportPanel() {
  const items = useImportQueue((s) => s.items);
  const keepBoth = useImportQueue((s) => s.keepBoth);
  const dismiss = useImportQueue((s) => s.dismiss);
  const clearFinished = useImportQueue((s) => s.clearFinished);
  if (!items.length) return null;

  const active = items.filter(isActive);
  const done = items.filter((i) => i.status === 'done').length;
  const current = items.find((i) => i.status === 'hashing' || i.status === 'saving');
  const attention = items.filter((i) => i.status === 'duplicate' || i.status === 'error');
  const total = items.length;
  const finished = total - active.length;

  return (
    <section
      aria-label="Adding files"
      className="space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-soft-sm"
    >
      <div className="flex items-center gap-2">
        {active.length ? (
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
        )}
        <p className="flex-1 font-semibold" aria-live="polite">
          {active.length
            ? `Adding files… ${finished} of ${total}`
            : `${done} ${done === 1 ? 'file' : 'files'} added`}
        </p>
        {!active.length && (
          <Button variant="ghost" size="sm" onClick={clearFinished}>
            Done
          </Button>
        )}
      </div>

      {active.length > 0 && (
        <progress
          className="h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-surface-muted [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary"
          max={total}
          value={finished}
          aria-label="Files added"
        />
      )}

      {current && (
        <div className="flex items-center gap-3 text-sm">
          <span className="min-w-0 flex-1 truncate font-semibold">{current.file.name}</span>
          <span className="shrink-0 text-fg-muted">
            {formatBytes(current.file.size)} · {STAGE[current.status]}
            {current.status === 'hashing' && current.progress !== null
              ? ` ${Math.round(current.progress * 100)}%`
              : '…'}
          </span>
        </div>
      )}

      {attention.length > 0 && (
        <ul className="space-y-2" aria-label="Needs your attention">
          {attention.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-muted p-3 text-sm"
            >
              {item.status === 'duplicate' ? (
                <Copy className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
              ) : (
                <CircleAlert className="size-4 shrink-0 text-danger" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 break-words">
                <span className="font-semibold">{item.file.name}</span>{' '}
                {item.status === 'duplicate'
                  ? `is already in your library as "${item.duplicate?.existingTitle}".`
                  : item.error}
              </span>
              {item.status === 'duplicate' && (
                <Button variant="secondary" size="sm" onClick={() => keepBoth(item.id)}>
                  Keep both
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                icon={item.status === 'duplicate' ? undefined : <X />}
                onClick={() => dismiss(item.id)}
                aria-label={
                  item.status === 'duplicate'
                    ? `Skip ${item.file.name}`
                    : `Dismiss ${item.file.name}`
                }
              >
                {item.status === 'duplicate' ? 'Skip' : 'Dismiss'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
