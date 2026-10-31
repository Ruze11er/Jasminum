import { useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { clock } from '@/lib/clock';
import { parseLockRecord, useLockStore, writeLockHint } from '@/stores/lockStore';

/**
 * Keeps the lock in step with the setting, and locks again when the app has been in the
 * background for the chosen time. Returns whether the app is locked.
 */
export function useAppLock() {
  const locked = useLockStore((s) => s.locked);
  // undefined while loading, null when the lock is off. Read directly (not via
  // settings.ts) so the validation library stays out of the start-up bundle.
  const record = useLiveQuery(
    async () => parseLockRecord((await db.settings.get('appLock'))?.value),
    [],
  );
  const hiddenAt = useRef<number | null>(null);
  const firstLoad = useRef(true);

  useEffect(() => {
    if (record === undefined) return;
    writeLockHint(record !== null);
    if (record === null) useLockStore.getState().unlock();
    // The lock exists but the hint didn't (e.g. just restored from a backup): lock now.
    else if (firstLoad.current && !locked) useLockStore.getState().lock();
    firstLoad.current = false;
    // Only when the setting changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record]);

  useEffect(() => {
    const onVisibility = () => {
      if (!record) return;
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = clock.now();
        if (record.lockAfterMinutes === 0) useLockStore.getState().lock();
      } else if (hiddenAt.current !== null) {
        const away = clock.now() - hiddenAt.current;
        if (away >= record.lockAfterMinutes * 60_000) useLockStore.getState().lock();
        hiddenAt.current = null;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [record]);

  return { locked: locked && record !== null, record };
}
