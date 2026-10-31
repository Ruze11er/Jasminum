import { DatabaseZap, RefreshCw } from 'lucide-react';
import { Button, EmptyState } from '@/design-system';
import { useDataStatus } from '@/data/bootstrap';

/**
 * Blocks the app when local storage can't be used, instead of letting pages fail silently.
 * - unavailable: the database couldn't open (e.g. storage disabled or a private window).
 * - outdated: another tab installed a newer version and needs this tab to reload.
 */
export function DataStatusScreen() {
  const { status, error } = useDataStatus();
  if (status !== 'unavailable' && status !== 'outdated') return null;

  const outdated = status === 'outdated';
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-bg p-6">
      <div className="max-w-md">
        <EmptyState
          icon={outdated ? <RefreshCw /> : <DatabaseZap />}
          title={outdated ? 'Jasminum was updated' : "Can't open your data"}
          description={
            outdated
              ? 'A newer version is open in another tab. Reload to continue. Your data is safe.'
              : "This browser isn't letting Jasminum store data. If you're in a private or incognito window, open Jasminum in a normal window. Also check that site storage isn't blocked."
          }
          action={<Button onClick={() => window.location.reload()}>Reload</Button>}
        />
        {error && <p className="mt-2 text-center text-xs break-words text-fg-muted">{error}</p>}
      </div>
    </div>
  );
}
