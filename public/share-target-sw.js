/*
 * Service-worker add-on: the Android share target.
 *
 * When someone shares files to Jasminum ("Share → Jasminum"), the system opens the app
 * with a POST to /share-target. There is no server, so the service worker receives it:
 * it keeps the files in a private cache and sends the app to /library?shared=1, where
 * the page imports them (src/features/library/sharedFiles.ts) and empties the cache.
 *
 * Plain JS on purpose: it's loaded with importScripts() by the generated service worker.
 */
const SHARE_CACHE = 'jasminum-share-target';
const MAX_FILES = 50;

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || url.pathname !== '/share-target') return;

  event.respondWith(
    (async () => {
      try {
        const form = await event.request.formData();
        const files = form
          .getAll('files')
          .filter((f) => f && typeof f === 'object' && 'name' in f)
          .slice(0, MAX_FILES);
        const cache = await caches.open(SHARE_CACHE);
        const batch = Date.now();
        await Promise.all(
          files.map((file, i) =>
            cache.put(
              `/__shared__/${batch}-${i}`,
              new Response(file, {
                headers: {
                  'content-type': file.type || 'application/octet-stream',
                  'x-file-name': encodeURIComponent(file.name || `shared-file-${i + 1}`),
                  'x-last-modified': String(file.lastModified || batch),
                },
              }),
            ),
          ),
        );
        return Response.redirect(`/library?shared=${files.length}`, 303);
      } catch {
        return Response.redirect('/library?shared=error', 303);
      }
    })(),
  );
});
