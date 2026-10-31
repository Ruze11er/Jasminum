/**
 * Browser storage capabilities: how much space is used, and whether the browser has
 * promised not to clear the app's data under storage pressure ("persistent storage").
 * Every function degrades gracefully when the API is missing.
 */

export interface StorageEstimate {
  usage: number;
  quota: number;
  /** 0–1 */
  ratio: number;
}

export const STORAGE_WARN_RATIO = 0.8;

export async function getStorageEstimate(): Promise<StorageEstimate | null> {
  try {
    const est = await navigator.storage?.estimate?.();
    if (!est || !est.quota) return null;
    const usage = est.usage ?? 0;
    return { usage, quota: est.quota, ratio: usage / est.quota };
  } catch {
    return null;
  }
}

/** true/false, or null if the browser can't tell us. */
export async function isStoragePersisted(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persisted) return null;
    return await navigator.storage.persisted();
  } catch {
    return null;
  }
}

/**
 * Asks the browser to protect our data from automatic clean-up. Chrome decides silently
 * (installed apps are usually approved); Firefox shows a prompt; Safari approves
 * home-screen apps.
 */
export async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

/** Running as an installed app (home screen / desktop app window) rather than a browser tab. */
export function isInstalledApp(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

/** iPhone / iPad, including iPadOS reporting itself as a Mac. */
export function isAppleMobile(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** Space kept free on top of a file's size, so the database itself never runs out. */
const SAFETY_MARGIN = 20 * 1024 * 1024;

/**
 * Whether a file of this size should fit. Returns true when the browser can't tell us,
 * since the write itself still fails safely with a quota error.
 */
export async function hasRoomFor(bytes: number): Promise<boolean> {
  const est = await getStorageEstimate();
  if (!est) return true;
  return est.quota - est.usage >= bytes * 1.05 + SAFETY_MARGIN;
}
