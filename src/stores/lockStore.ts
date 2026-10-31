import { create } from 'zustand';

/**
 * Whether the app lock screen is showing. The real setting lives in the database; this
 * localStorage hint lets the app start locked before the database has loaded, so the
 * content never flashes on screen.
 */
export const LOCK_HINT_KEY = 'jasminum:app-lock';

const readHint = () => {
  try {
    return localStorage.getItem(LOCK_HINT_KEY) === '1';
  } catch {
    return false;
  }
};

export function writeLockHint(enabled: boolean) {
  try {
    if (enabled) localStorage.setItem(LOCK_HINT_KEY, '1');
    else localStorage.removeItem(LOCK_HINT_KEY);
  } catch {
    // Private mode: the app still locks once the setting loads.
  }
}

interface LockState {
  locked: boolean;
  lock: () => void;
  unlock: () => void;
}

export const useLockStore = create<LockState>((set) => ({
  locked: readHint(),
  lock: () => set({ locked: true }),
  unlock: () => set({ locked: false }),
}));

export interface LockRecord {
  salt: string;
  hash: string;
  iterations: number;
  lockAfterMinutes: 0 | 1 | 5 | 15;
}

/**
 * The stored lock setting, checked by hand (the full validation lives in settings.ts; this
 * small copy keeps it out of the start-up bundle). Anything malformed counts as off.
 */
export function parseLockRecord(value: unknown): LockRecord | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const ok =
    typeof v.salt === 'string' &&
    typeof v.hash === 'string' &&
    typeof v.iterations === 'number' &&
    [0, 1, 5, 15].includes(v.lockAfterMinutes as number);
  return ok ? (v as unknown as LockRecord) : null;
}
