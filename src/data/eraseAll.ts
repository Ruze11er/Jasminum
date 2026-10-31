import { SHARE_CACHE } from '@/platform/share';
import { db } from './db';
import { FILES_DIR } from './files/opfsFileStore';

/** Every localStorage and sessionStorage key the app writes starts with this. */
const KEY_PREFIX = 'jasminum';

/**
 * Erases everything Jasminum keeps on this device: the database (including the Trash and
 * the IndexedDB file fallback), stored files and restore snapshots (OPFS), files waiting
 * from a share, and local preferences. The app's own code stays cached, so it still opens
 * offline afterwards. Call `restartApp()` next: this tab's state is gone.
 */
export async function eraseAllData(): Promise<void> {
  // Other open tabs get a "version change" and close their connection (see bootstrap.ts).
  await db.delete({ disableAutoOpen: true });

  try {
    const root = await navigator.storage?.getDirectory?.();
    if (root) await root.removeEntry(FILES_DIR, { recursive: true });
  } catch (err) {
    if ((err as { name?: string }).name !== 'NotFoundError') throw err;
  }

  try {
    if (typeof caches !== 'undefined') await caches.delete(SHARE_CACHE);
  } catch {
    // No Cache API: nothing was ever shared in.
  }

  for (const getStorage of [() => localStorage, () => sessionStorage]) {
    try {
      const storage = getStorage();
      const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(
        (k): k is string => !!k?.startsWith(KEY_PREFIX),
      );
      for (const k of keys) storage.removeItem(k);
    } catch {
      // Storage blocked: nothing could have been saved there.
    }
  }
}

/** Starts the app fresh from Home, as on a first visit. */
export function restartApp() {
  window.location.replace('/');
}
