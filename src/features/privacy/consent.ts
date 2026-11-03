import { PRIVACY_POLICY_VERSION } from './version';

/**
 * Whether this browser has agreed to the current privacy policy. Kept in localStorage, not
 * the database, so the check is instant at start-up and the app never shows before it.
 * "Delete everything" removes it with the other `jasminum` keys, so you're asked again.
 */
export const PRIVACY_ACCEPTED_KEY = 'jasminum:privacy-accepted';

export interface PrivacyAcceptance {
  version: string;
  /** When it was accepted (epoch ms). */
  at: number;
}

export function readAcceptance(): PrivacyAcceptance | null {
  try {
    const v = JSON.parse(localStorage.getItem(PRIVACY_ACCEPTED_KEY) ?? 'null') as unknown;
    if (!v || typeof v !== 'object') return null;
    const { version, at } = v as Record<string, unknown>;
    return typeof version === 'string' && typeof at === 'number' ? { version, at } : null;
  } catch {
    return null;
  }
}

export const hasAcceptedPolicy = () => readAcceptance()?.version === PRIVACY_POLICY_VERSION;

export function writeAcceptance(at: number) {
  try {
    const value: PrivacyAcceptance = { version: PRIVACY_POLICY_VERSION, at };
    localStorage.setItem(PRIVACY_ACCEPTED_KEY, JSON.stringify(value));
  } catch {
    // Private mode: the agreement lasts for this visit and is asked again next time.
  }
}
