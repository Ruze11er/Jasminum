import { expect, test } from '@playwright/test';

test('navigates between main sections', async ({ page, isMobile }) => {
  await page.goto('/');
  await expect(page.getByText('Quote of the day')).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Main navigation' }).locator('visible=true');
  await nav.getByRole('link', { name: 'Library' }).click();
  await expect(page.getByRole('heading', { name: 'Library', level: 1 })).toBeVisible();

  // Phones use the bottom bar; larger screens use the sidebar.
  await expect(nav).toHaveCount(1);
  await expect(nav).toHaveClass(isMobile ? /bottom-0/ : /sticky/);
});

test(
  'keeps working offline after the first visit',
  { tag: '@offline' },
  async ({ page, context }) => {
    await page.goto('/');
    await expect(page.getByText('Quote of the day')).toBeVisible();

    // Wait for the service worker to finish caching the app. It starts controlling pages
    // from the next load (the app never takes over a page mid-session), so reload once.
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    // Cut the network: every request that would leave the device now fails, so anything
    // that still loads must come from the service worker's offline cache.
    const networkRequests: string[] = [];
    await context.route('**/*', (route) => {
      networkRequests.push(new URL(route.request().url()).pathname);
      return route.abort('internetdisconnected');
    });
    await page.reload();
    await expect(page.getByText('Quote of the day')).toBeVisible();

    // A deep link that was never visited also loads offline.
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
    await page.goto('/notes');
    await expect(page.getByRole('heading', { name: 'Notes', level: 1 })).toBeVisible();
    expect(networkRequests).toEqual([]);
  },
);

test('remembers the chosen theme after reload', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
});
