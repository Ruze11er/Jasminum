import { test as base } from '@playwright/test';

export { expect } from '@playwright/test';
export type { Page } from '@playwright/test';

/**
 * Every spec imports `test` from here. It marks the welcome splash as already seen, so it
 * doesn't cover the page for four seconds after each load. welcome.spec.ts tests the splash.
 */
export const test = base.extend({
  context: async ({ context }, provide) => {
    await context.addInitScript(() => {
      try {
        sessionStorage.setItem('jasminum:welcome-seen', '1');
      } catch {
        // about:blank and other opaque pages have no storage.
      }
    });
    await provide(context);
  },
});
