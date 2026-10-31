import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

/**
 * SHA-256 of a file, read in chunks so a 200 MB ebook is never held in memory at once
 * (the browser's crypto.subtle.digest needs the whole file as one buffer). Used to spot
 * duplicates and to name stored files by their content.
 */
export async function sha256OfBlob(
  blob: Blob,
  onProgress?: (bytesDone: number) => void,
): Promise<string> {
  const hash = sha256.create();
  const reader = blob.stream().getReader();
  let done = 0;
  let reported = 0;
  for (;;) {
    const { done: end, value } = await reader.read();
    if (end) break;
    hash.update(value);
    done += value.byteLength;
    if (onProgress && done - reported >= PROGRESS_STEP) {
      reported = done;
      onProgress(done);
    }
  }
  onProgress?.(done);
  return bytesToHex(hash.digest());
}

const PROGRESS_STEP = 4 * 1024 * 1024;

export type HashMessage =
  | { type: 'progress'; done: number }
  | { type: 'done'; hash: string }
  | { type: 'error'; message: string };

/**
 * Hashes in a Web Worker so the page stays responsive, falling back to the main thread
 * where workers aren't available (tests).
 */
export function hashFile(file: Blob, onProgress?: (bytesDone: number) => void): Promise<string> {
  if (typeof Worker === 'undefined') return sha256OfBlob(file, onProgress);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./hash.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<HashMessage>) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        onProgress?.(msg.done);
        return;
      }
      worker.terminate();
      if (msg.type === 'done') resolve(msg.hash);
      else reject(new Error(msg.message));
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || 'Could not read the file'));
    };
    worker.postMessage(file);
  });
}

/** Content-addressed storage key: the same bytes are stored once. */
export const storageKeyFor = (hash: string) => `sha256-${hash}`;
