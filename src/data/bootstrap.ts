import { create } from 'zustand';
import { logActivity } from './activity';
import { db } from './db';

type DataStatus = 'loading' | 'ready' | 'unavailable' | 'outdated' | 'erased';

/** Database health, read by the app shell to show a blocking message if storage fails. */
export const useDataStatus = create<{ status: DataStatus; error?: string }>(() => ({
  status: 'loading',
}));

const idle = (fn: () => void) =>
  'requestIdleCallback' in window ? window.requestIdleCallback(fn) : setTimeout(fn, 200);

let started = false;

/**
 * Opens the database and runs start-up housekeeping. Never blocks the first paint:
 * pages render immediately and their live queries resolve once the database is open.
 * Housekeeping modules are imported on demand to keep the first download small.
 */
export async function startDataServices(): Promise<void> {
  if (started) return;
  started = true;

  // Another tab installed a newer version of the app (close so its upgrade can proceed),
  // or erased everything ("Delete everything" deletes the database: no new version).
  db.on('versionchange', (event: IDBVersionChangeEvent) => {
    db.close();
    useDataStatus.setState({ status: event.newVersion === null ? 'erased' : 'outdated' });
  });

  try {
    await db.open();
  } catch (err) {
    useDataStatus.setState({
      status: 'unavailable',
      error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    });
    return;
  }
  useDataStatus.setState({ status: 'ready' });

  try {
    await db.transaction('rw', db.activity, () => logActivity('app.opened', 'app', null));
  } catch (err) {
    console.error('Could not log app start', err);
  }

  idle(() => {
    void (async () => {
      try {
        const { purgeExpiredTrash } = await import('./trash');
        await purgeExpiredTrash();
        const { pruneSnapshots } = await import('./backup/snapshots');
        await pruneSnapshots();
        const { searchIndex } = await import('./search/searchIndex');
        await searchIndex.rebuild();
      } catch (err) {
        console.error('Start-up housekeeping failed', err);
      }
    })();
  });
}
