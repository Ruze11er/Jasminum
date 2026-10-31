import { DatabaseZap, RefreshCw } from 'lucide-react';
import { Button, EmptyState } from '@/design-system';
import { useDataStatus } from '@/data/bootstrap';

const MESSAGES = {
  unavailable: {
    title: "Can't open your data",
    description:
      "This browser isn't letting Jasminum store data. If you're in a private or incognito window, open Jasminum in a normal window. Also check that site storage isn't blocked.",
  },
  outdated: {
    title: 'Jasminum was updated',
    description: 'A newer version is open in another tab. Reload to continue. Your data is safe.',
  },
  erased: {
    title: 'Your data was erased',
    description: 'Everything was deleted from this device in another tab. Reload to start fresh.',
  },
};

/**
 * Blocks the app when local storage can't be used, instead of letting pages fail silently.
 * - unavailable: the database couldn't open (e.g. storage disabled or a private window).
 * - outdated: another tab installed a newer version and needs this tab to reload.
 * - erased: another tab used "Delete everything".
 */
export function DataStatusScreen() {
  const { status, error } = useDataStatus();
  if (status !== 'unavailable' && status !== 'outdated' && status !== 'erased') return null;

  const { title, description } = MESSAGES[status];
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-bg p-6">
      <div className="max-w-md">
        <EmptyState
          icon={status === 'unavailable' ? <DatabaseZap /> : <RefreshCw />}
          title={title}
          description={description}
          action={<Button onClick={() => window.location.reload()}>Reload</Button>}
        />
        {error && <p className="mt-2 text-center text-xs break-words text-fg-muted">{error}</p>}
      </div>
    </div>
  );
}
