/**
 * Files shared into the app on Android ("Share → Jasminum"). The service worker
 * (public/share-target-sw.js) parks them in a private cache. The Library asks before
 * importing them, because any website can send that same request: only the user can
 * tell whether they shared these files themselves.
 */
import { SHARE_CACHE } from '@/platform/share';

export { SHARE_CACHE };

export interface SharedFileInfo {
  name: string;
  size: number;
}

/** Opens the cache only if it exists, so a visit to the Library never creates it. */
async function openShareCache(): Promise<Cache | null> {
  if (typeof caches === 'undefined') return null;
  if (!(await caches.has(SHARE_CACHE))) return null;
  return caches.open(SHARE_CACHE);
}

const nameOf = (response: Response) =>
  decodeURIComponent(response.headers.get('x-file-name') ?? 'Shared file');

/** What's waiting to be added, without taking it out. */
export async function peekSharedFiles(): Promise<SharedFileInfo[]> {
  const cache = await openShareCache();
  if (!cache) return [];
  const out: SharedFileInfo[] = [];
  for (const request of await cache.keys()) {
    const response = await cache.match(request);
    if (response) out.push({ name: nameOf(response), size: (await response.blob()).size });
  }
  return out;
}

/** Takes the shared files out (emptying the cache) so the Library can import them. */
export async function takeSharedFiles(): Promise<File[]> {
  const cache = await openShareCache();
  if (!cache) return [];
  const files: File[] = [];
  for (const request of await cache.keys()) {
    const response = await cache.match(request);
    if (response) {
      files.push(
        new File([await response.blob()], nameOf(response), {
          type: response.headers.get('content-type') ?? '',
          lastModified: Number(response.headers.get('x-last-modified')) || Date.now(),
        }),
      );
    }
    await cache.delete(request);
  }
  return files;
}

/** Throws the shared files away without importing them. */
export async function discardSharedFiles(): Promise<void> {
  if (typeof caches === 'undefined') return;
  await caches.delete(SHARE_CACHE);
}
