/**
 * Getting stored files back out: download, share to another app (Web Share), or open in
 * a new tab. Feature-detected; never checks the browser name.
 */

/**
 * Types that are safe to open in a tab. A blob: URL runs with the app's origin, so an
 * opened HTML or SVG file could run scripts with access to everyone's data. Those (and
 * anything unknown) are download-only; text-like files are forced to text/plain.
 */
const SAFE_INLINE: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  txt: 'text/plain',
  md: 'text/plain',
  markdown: 'text/plain',
  csv: 'text/plain',
  tsv: 'text/plain',
  json: 'text/plain',
  log: 'text/plain',
};

export const canOpenInTab = (ext: string) => ext in SAFE_INLINE;

/** Where the service worker parks files shared into the app (public/share-target-sw.js). */
export const SHARE_CACHE = 'jasminum-share-target';

/** Opens the file in a new tab with a safe content type. Returns false if not allowed. */
export function openInTab(blob: Blob, ext: string): boolean {
  const type = SAFE_INLINE[ext];
  if (!type) return false;
  const url = URL.createObjectURL(new Blob([blob], { type: `${type};charset=utf-8` }));
  // With 'noopener' window.open always returns null, so there's nothing to check.
  window.open(url, '_blank', 'noopener');
  // The new tab has loaded the bytes by then; free the memory later.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

/** Link types a note may open. Anything else (javascript:, data:, blob:, …) is refused. */
const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/** The link as a full URL if it's safe to open, otherwise null. */
export function safeLinkUrl(href: string | null | undefined): string | null {
  if (!href) return null;
  try {
    const url = new URL(href);
    return SAFE_LINK_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Opens a link from user content in a new tab (an installed app hands it to the browser).
 * 'noopener' stops the page from reaching back into the app. Returns false if not allowed.
 */
export function openExternalLink(href: string | null | undefined): boolean {
  const url = safeLinkUrl(href);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

export function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function canShareFiles(file: File): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/** Shares a file to another app. Cancelling the share sheet isn't an error. */
export async function shareFile(file: File, title: string): Promise<'shared' | 'cancelled'> {
  try {
    await navigator.share({ files: [file], title });
    return 'shared';
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') return 'cancelled';
    throw err;
  }
}
