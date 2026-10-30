import { useCallback, useEffect, useState } from 'react';
import { HardDrive, ShieldAlert, ShieldCheck, Smartphone } from 'lucide-react';
import { Button, Card, CardHeader, toast } from '@/design-system';
import { getFileStore } from '@/data/files';
import { cn } from '@/lib/cn';
import { formatBytes } from '@/lib/format';
import {
  getStorageEstimate,
  isAppleMobile,
  isInstalledApp,
  isStoragePersisted,
  requestPersistentStorage,
  STORAGE_WARN_RATIO,
  type StorageEstimate,
} from '@/platform/storage';

interface Info {
  estimate: StorageEstimate | null;
  persisted: boolean | null;
  fileStore: 'opfs' | 'idb';
}

/** Shows how much space Jasminum uses and whether the browser has promised to keep the data. */
async function loadInfo(): Promise<Info> {
  const [estimate, persisted, store] = await Promise.all([
    getStorageEstimate(),
    isStoragePersisted(),
    getFileStore(),
  ]);
  return { estimate, persisted, fileStore: store.kind };
}

export function StorageCard() {
  const [info, setInfo] = useState<Info | null>(null);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    void loadInfo().then((next) => {
      if (!cancelled) setInfo(next);
    });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const protect = async () => {
    const granted = await requestPersistentStorage();
    refresh();
    if (granted) toast({ message: 'Your data is now protected' });
    else
      toast({
        tone: 'info',
        message: 'The browser said not yet. Installing the app usually helps.',
        durationMs: 6000,
      });
  };

  const showIosHint = isAppleMobile() && !isInstalledApp();
  const ratio = info?.estimate?.ratio ?? 0;
  const nearlyFull = ratio >= STORAGE_WARN_RATIO;

  return (
    <Card>
      <CardHeader title="Storage" icon={<HardDrive />} />

      {info?.estimate ? (
        <div>
          <div className="flex justify-between text-sm">
            <span className="font-semibold">{formatBytes(info.estimate.usage)} used</span>
            <span className="text-fg-muted">of {formatBytes(info.estimate.quota)} available</span>
          </div>
          <div
            role="progressbar"
            aria-label="Storage used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(ratio * 100)}
            className="mt-2 h-2.5 overflow-hidden rounded-full bg-primary-soft"
          >
            <div
              className={cn('h-full rounded-full', nearlyFull ? 'bg-danger' : 'bg-brand')}
              style={{ width: `${Math.max(ratio * 100, ratio > 0 ? 1 : 0)}%` }}
            />
          </div>
          {nearlyFull && (
            <p className="mt-2 text-sm text-danger">
              Storage is nearly full. Consider removing large files you no longer need.
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-fg-muted">This browser doesn't report storage usage.</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-surface-muted p-3">
        {info?.persisted ? (
          <ShieldCheck className="size-5 shrink-0 text-success" aria-hidden="true" />
        ) : (
          <ShieldAlert className="size-5 shrink-0 text-warning" aria-hidden="true" />
        )}
        <p className="min-w-48 flex-1 text-sm">
          {info?.persisted === true && (
            <>
              <strong>Protected.</strong> The browser won't clear your data to free up space.
            </>
          )}
          {info?.persisted === false && (
            <>
              <strong>Not protected yet.</strong> The browser may clear data if space runs low.
            </>
          )}
          {info?.persisted === null && "This browser can't report whether your data is protected."}
        </p>
        {info?.persisted === false && (
          <Button size="sm" onClick={protect}>
            Protect my data
          </Button>
        )}
      </div>

      {showIosHint && (
        <div className="mt-3 flex gap-3 rounded-xl bg-warning-soft p-3 text-sm">
          <Smartphone className="size-5 shrink-0 text-warning" aria-hidden="true" />
          <p>
            <strong>Add Jasminum to your Home Screen.</strong> Safari can delete data from websites
            you haven't opened for 7 days. Home Screen apps are exempt. Tap Share, then "Add to Home
            Screen".
          </p>
        </div>
      )}

      {info && (
        <p className="mt-3 text-xs text-fg-muted">
          File storage: {info.fileStore === 'opfs' ? 'optimized (OPFS)' : 'standard (IndexedDB)'}
        </p>
      )}
    </Card>
  );
}
