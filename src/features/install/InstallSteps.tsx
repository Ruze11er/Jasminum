import { CheckCircle2, Download, Share, SquarePlus } from 'lucide-react';
import { Button, toast } from '@/design-system';
import { promptInstall, useInstallMethod } from '@/platform/install';

/**
 * The right way to install on this device: done, a button (Chrome, Edge, Android), the
 * Share-menu steps (iPhone, iPad), or a pointer to the browser menu.
 */
export function InstallSteps({ compact = false }: { compact?: boolean }) {
  const method = useInstallMethod();

  if (method === 'installed') {
    return (
      <p className="flex items-center gap-2 text-sm font-semibold text-success">
        <CheckCircle2 className="size-4" aria-hidden="true" />
        Installed. You're using the app.
      </p>
    );
  }

  if (method === 'prompt') {
    return (
      <Button
        size="sm"
        icon={<Download />}
        onClick={() =>
          void promptInstall().then(
            (r) => r === 'accepted' && toast({ message: 'Jasminum is installed' }),
          )
        }
      >
        Install app
      </Button>
    );
  }

  if (method === 'apple') {
    return (
      <ol className="space-y-2 text-sm">
        <li className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary-soft-fg">
            1
          </span>
          <span>
            Tap the <strong>Share</strong> button{' '}
            <Share
              className="inline size-4 align-text-bottom"
              aria-label="(the square with an arrow)"
            />{' '}
            in Safari.
          </span>
        </li>
        <li className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary-soft-fg">
            2
          </span>
          <span>
            Choose <strong>Add to Home Screen</strong>{' '}
            <SquarePlus className="inline size-4 align-text-bottom" aria-hidden="true" />.
          </span>
        </li>
        <li className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary-soft-fg">
            3
          </span>
          <span>Open Jasminum from your Home Screen from now on.</span>
        </li>
        {!compact && (
          <li className="pt-1 text-fg-muted">
            On iPhone and iPad, the Home Screen app keeps its data safe from Safari's automatic
            clean-up. It has its own storage, separate from Safari tabs.
          </li>
        )}
      </ol>
    );
  }

  return (
    <p className="text-sm text-fg-muted">
      Look for <strong className="text-fg">Install</strong> or{' '}
      <strong className="text-fg">Add to Home Screen</strong> in your browser's menu. If there isn't
      one, Jasminum still works fully in this tab.
    </p>
  );
}
