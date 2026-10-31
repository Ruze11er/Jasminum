/**
 * Files shared into the app on Android ("Share → Jasminum"). The service worker
 * (public/share-target-sw.js) parks them in a private cache; this takes them out (and
 * empties the cache) so the Library can import them.
 */
export const SHARE_CACHE = 'jasminum-share-target';

export async function takeSharedFiles(): Promise<File[]> {
  if (typeof caches === 'undefined') return [];
  const cache = await caches.open(SHARE_CACHE);
  const files: File[] = [];
  for (const request of await cache.keys()) {
    const response = await cache.match(request);
    if (response) {
      const name = decodeURIComponent(response.headers.get('x-file-name') ?? 'Shared file');
      files.push(
        new File([await response.blob()], name, {
          type: response.headers.get('content-type') ?? '',
          lastModified: Number(response.headers.get('x-last-modified')) || Date.now(),
        }),
      );
    }
    await cache.delete(request);
  }
  return files;
}
