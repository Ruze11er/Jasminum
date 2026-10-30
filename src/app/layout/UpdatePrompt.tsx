import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { Button } from '@/design-system';

const OFFLINE_NOTICE_MS = 6000;

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

  // "Ready to work offline" is just information: hide it on its own so it never sits on
  // top of the page. "New version" stays until the user decides.
  useEffect(() => {
    if (!offlineReady || needRefresh) return;
    const timer = setTimeout(() => setOfflineReady(false), OFFLINE_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [offlineReady, needRefresh, setOfflineReady]);

  if (!needRefresh && !offlineReady) return null;

  return (
    <div
      role="status"
      className="flex w-full max-w-md animate-fade-in items-center gap-3 rounded-2xl border border-line bg-surface-raised p-4 shadow-soft-lg"
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
