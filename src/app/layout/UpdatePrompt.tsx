import { useRegisterSW } from 'virtual:pwa-register/react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { Button } from '@/design-system';

/**
 * Tells the user when a new version is ready, and when the app is ready to work offline.
 * Updates are never applied automatically, so nothing is interrupted mid-edit.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh && !offlineReady) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-surface-raised p-4 shadow-soft-lg md:bottom-6"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg">
        {needRefresh ? <RefreshCw className="size-5" /> : <CloudOff className="size-5" />}
      </span>
      <p className="flex-1 text-sm">
        {needRefresh ? (
          <>
            <strong className="block">A new version is ready</strong>
            Your data stays safe. Refresh when you're ready.
          </>
        ) : (
          <>
            <strong className="block">Ready to work offline</strong>
            Jasminum now works without internet.
          </>
        )}
      </p>
      {needRefresh ? (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
            Later
          </Button>
          <Button size="sm" onClick={() => updateServiceWorker(true)}>
            Refresh
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setOfflineReady(false)}>
          OK
        </Button>
      )}
    </div>
  );
}
