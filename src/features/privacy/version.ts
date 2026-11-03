/**
 * The privacy policy's version: the date it last changed (YYYY-MM-DD), shown as "Last
 * updated". Change it only when people should read the policy again: everyone who agreed
 * to an older version is asked to agree again. No imports, so e2e/fixtures.ts can use it.
 */
export const PRIVACY_POLICY_VERSION = '2026-11-03';

/** "November 3, 2026", from the policy version. */
export function policyUpdatedLabel() {
  const [y, m, d] = PRIVACY_POLICY_VERSION.split('-').map(Number);
  return new Date(y!, m! - 1, d).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
