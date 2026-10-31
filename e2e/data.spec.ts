import { expect, test, type Page } from '@playwright/test';

async function saveName(page: Page, name: string) {
  await page.goto('/settings');
  const input = page.getByLabel('Your name');
  await input.fill(name);
  await input.press('Enter');
  await expect(page.getByText('Name saved')).toBeVisible();
}

test(
  'saved data survives a reload and works offline',
  { tag: '@offline' },
  async ({ page, context }) => {
    await saveName(page, 'Jasmine');

    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(', Jasmine');

    // Let the service worker take control, then cut the network.
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.route('**/*', (route) => route.abort('internetdisconnected'));

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(', Jasmine');

    // Edits while offline are saved too.
    await saveName(page, 'Jas');
    await page.reload();
    await expect(page.getByLabel('Your name')).toHaveValue('Jas');
  },
);

test(
  'uses OPFS for file storage and reports storage usage',
  { tag: '@files' },
  async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByText('File storage: optimized (OPFS)')).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'Storage used' })).toBeVisible();
    await expect(page.getByText(/Protected\.|Not protected yet\./)).toBeVisible();
  },
);

test('the Trash is reachable from Settings', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('link', { name: 'Trash' }).last().click();
  await expect(page.getByRole('heading', { name: 'Trash', level: 1 })).toBeVisible();
  await expect(page.getByText('Trash is empty')).toBeVisible();
});
