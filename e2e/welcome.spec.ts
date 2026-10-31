// Uses the plain Playwright test (not ./fixtures), so the welcome splash shows.
import { expect, test } from '@playwright/test';

test('the welcome splash shows on open, fades into Home and stays away on reload', async ({
  page,
}) => {
  await page.goto('/');
  const welcome = page.getByTestId('welcome');
  await expect(welcome).toBeVisible();
  await expect(welcome.getByText('Jasminum')).toBeVisible();
  await expect(welcome.getByText('Your days, gently organized.')).toBeVisible();
  await expect(welcome).toHaveCount(0, { timeout: 8000 });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(welcome).toHaveCount(0);
});

test('a tap skips the welcome splash', async ({ page }) => {
  await page.goto('/tasks');
  const welcome = page.getByTestId('welcome');
  await expect(welcome).toBeVisible();
  await page.mouse.click(10, 10);
  // Gone within the fade, well before the splash would end on its own.
  await expect(welcome).toHaveCount(0, { timeout: 1200 });
  await expect(page.getByRole('heading', { name: 'Tasks', level: 1 })).toBeVisible();
});
