import { test as base } from '@playwright/test';
import { PRIVACY_POLICY_VERSION } from '../src/features/privacy/version';

export { expect } from '@playwright/test';
export type { Page } from '@playwright/test';

/**
 * Every spec imports `test` from here. It marks the welcome splash as already seen, so it
 * doesn't cover the page for four seconds after each load, and agrees to the privacy policy.
 * welcome.spec.ts and privacy.spec.ts test those two screens.
 */
export const test = base.extend({
  context: async ({ context }, provide) => {
    await context.addInitScript((version) => {
      try {
        sessionStorage.setItem('jasminum:welcome-seen', '1');
        localStorage.setItem('jasminum:privacy-accepted', JSON.stringify({ version, at: 0 }));
      } catch {
        // about:blank and other opaque pages have no storage.
      }
    }, PRIVACY_POLICY_VERSION);
    await provide(context);
  },
});
